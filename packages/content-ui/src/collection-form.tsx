// CollectionForm — builds a create/edit form from a collection's fields. Each
// field renders its edit widget (resolved from the registry) with its label,
// help text (`meta.description`) and, for bounded strings, a character count;
// on submit the values are validated against the fields' Standard Schemas via
// `validateFields` (the same contract the REST write path enforces) and, only if
// clean, handed to `onSubmit` decoded. Field errors render inline; a form-level
// `error` slot surfaces server failures (e.g. a 409 conflict).
//
// Page chrome: the single `PageLayout.Header` carries the back link, the title
// and the actions — in `form` mode the Save/Create button lives THERE (a sticky
// action bar, not a card footer), next to the host's Cancel; in `field` mode
// (grouped collections saving per field) each edited field shows its own inline
// Save right under the input, so a section is ONE card, not a stack of five.
// Grouped collections show one section at a time; the section list lives in
// the sidebar on desktop (the host registers it) and in the `FieldGroupNav`
// strip on mobile.

import { type Collection, type InferFields, slugify } from "@voila/content";
import { Button } from "@voila.dev/ui/button";
import { cn } from "@voila.dev/ui/utils";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { FieldCard } from "./field-card";
import { FieldGroupNav } from "./field-group-nav";
import { FieldRenderer } from "./field-renderer";
import { FieldRow } from "./field-row";
import { dirtyFieldKeys } from "./lib/dirty";
import type { Doc } from "./lib/doc";
import { type FocusPath, FocusPathProvider } from "./lib/focus-path";
import { resolveFieldGroups } from "./lib/groups";
import { getFieldLabel, humanize } from "./lib/humanize";
import { useMessages } from "./lib/messages";
import { type FieldIssue, localizedFieldErrors, validateFields } from "./lib/validate";
import { type LocaleProgress, LocaleSwitcher } from "./locale-switcher";
import { LocalizedFieldEditor } from "./localized-field";
import { type BodyWidth, PageLayout } from "./page-layout";
import { EditRegistryProvider } from "./registry/context";
import { defaultEditRegistry, type EditRegistry, resolveEditWidget } from "./registry/edit";
import type { DisplayRegistry } from "./registry/registry";

/**
 * The typed document shape for a collection's fields — what `onSubmit` receives
 * once the form has validated. When `collection` is a config-inferred
 * `Collection<Slug, Fields>` this resolves to the exact per-field types (so the
 * host can hand the values straight to `client.<slug>.create`/`update` with no
 * cast); an untyped runtime `Collection` falls back to the loose `Doc`.
 */
export type FormValues<C extends Collection> =
  C extends Collection<string, infer Fields> ? InferFields<Fields> : Doc;

export interface CollectionFormProps<C extends Collection = Collection> {
  readonly collection: C;
  /**
   * Initial field values (e.g. the document being edited). Loosely typed on
   * purpose — a fetched document carries extra fields (`id`, timestamps) and a
   * new-document form may seed only some — so this is the erased `Doc`, while
   * the validated `onSubmit` output is the precise `FormValues<C>`.
   */
  readonly defaultValues?: Readonly<Doc>;
  /** Field keys to render, in order. Defaults to all non-hidden fields. */
  readonly fields?: ReadonlyArray<string>;
  /** Override edit widgets per kind/name. */
  readonly registry?: EditRegistry;
  /**
   * Display widgets for `readOnly` fields, which render as read-only rows
   * (never as inputs) so an editor still sees a system-owned value beside what
   * they can change. Defaults to the display defaults.
   */
  readonly displayRegistry?: DisplayRegistry;
  /**
   * Whether the form creates a document or edits one. A `readOnly` field is
   * OMITTED from a create (nothing has produced its value yet) and shown
   * read-only on an edit. Defaults to `"edit"` when `defaultValues` is given,
   * `"create"` otherwise.
   */
  readonly mode?: "create" | "edit";
  /**
   * The project's locales (`config.i18n.locales`). When set, localized fields
   * render one input per locale (admin translation); without it they fall back
   * to the kind's plain widget editing the raw record.
   */
  readonly locales?: ReadonlyArray<string>;
  /** Called with the decoded, validated values when the form is submitted. */
  readonly onSubmit: (values: FormValues<C>) => void | Promise<void>;
  readonly submitLabel?: string;
  /**
   * The page title shown in the pinned header (e.g. "Edit Fjords by Ferry" /
   * "New post"). When set (or `actions` is), the form renders a `PageLayout`
   * frame: a fixed header over a single scrolling body, matching the read/list
   * views. Omit both to render the bare form (e.g. embedded elsewhere).
   */
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  /** The header's back link (see `PageLayout.Back`). */
  readonly back?: ReactNode;
  /** Header actions rendered BEFORE the submit button (e.g. Cancel / Done). */
  readonly actions?: ReactNode;
  /** Content measure of the body. Defaults to `reading`. */
  readonly width?: BodyWidth;
  /** Form-level error (e.g. a server conflict) shown above the submit button. */
  readonly error?: string;
  /**
   * Server-side field errors keyed by field name — the shape
   * `ContentClientError.issuesByField()` produces from a 422 `VALIDATION` or
   * 409 `CONFLICT` envelope. Each new object is adopted into the form's field
   * errors, so they render inline and clear as the user edits (like local
   * validation); keys without a rendered field surface in the form-level slot.
   */
  readonly serverErrors?: Readonly<Record<string, string>>;
  /**
   * The active field group's id, when the collection declares `groups`. The
   * form renders one card for that group; a single Save submits (and validates)
   * the whole form. Optional and controlled — omit it and the form tracks its
   * own active group, defaulting to the first. Ignored without `groups`.
   */
  readonly activeGroup?: string;
  /** Called with a group id when the user picks one in the mobile strip. */
  readonly onGroupChange?: (id: string) => void;
  /**
   * How grouped collections lay out:
   * - `"section"` (default) — one group at a time, driven by `activeGroup`.
   *   Right for editing, where the sidebar names the section you are in.
   * - `"all"` — every group stacked, each in its own titled card. Right for
   *   CREATE, where hiding groups behind a nav the new record doesn't have yet
   *   would make most of the collection's fields unreachable.
   * Ignored when the collection declares no groups.
   */
  readonly groupLayout?: "section" | "all";
  /**
   * The project's default locale (`config.i18n.defaultLocale`). `required` on a
   * localized field means "this locale is filled" — the others are translations
   * that can land later. Defaults to the first entry in `locales`.
   */
  readonly defaultLocale?: string;
  /**
   * Notified whenever the form gains or loses unsaved edits. `CollectionForm`
   * guards full-page navigation itself (`beforeunload`), but in-app router
   * navigation is the host's to block — this is the signal it needs to do it.
   */
  readonly onDirtyChange?: (dirty: boolean) => void;
  /**
   * Called with the whole document as the user edits it — once on mount with
   * the defaults, then after every change (slug derivations included). What a
   * live preview renders from, so it shows unsaved work; grouped forms hold
   * every field, not just the visible group, so the document is complete.
   */
  readonly onValuesChange?: (values: Doc) => void;
  /**
   * Called when the user expands a nested row (a block, an array item) with
   * its path into the document (`["blocks", 2]`), or `null` on collapse. A
   * live preview can scroll to the matching section.
   */
  readonly onFocusPathChange?: (path: FocusPath | null) => void;
  /**
   * How the form saves:
   * - `"form"` (default) — one Save (in the header) validates and submits every
   *   rendered field at once.
   * - `"field"` — each edited field shows its own inline Save, which validates
   *   and submits just that field as a partial update. `onSubmit` receives a
   *   one-key document, so it only suits a PATCH-style update (collections, not
   *   the singleton's full-document `set`).
   */
  readonly saveMode?: "form" | "field";
}

function resolveFieldKeys(
  collection: Collection,
  fields: ReadonlyArray<string> | undefined,
  omitReadOnly: boolean,
): string[] {
  const keys = fields
    ? fields.filter((k) => Object.hasOwn(collection.fields, k))
    : Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
  return omitReadOnly ? keys.filter((k) => collection.fields[k]?.meta.readOnly !== true) : keys;
}

interface SlugDerivations {
  /** Source field key → the slug field keys that derive from it. */
  readonly bySource: Readonly<Record<string, ReadonlyArray<string>>>;
  /** Every slug field key that has a `from` source. */
  readonly derivable: ReadonlySet<string>;
}

// `slug({ from: "title" })` wiring: which rendered slug fields follow which
// source field. Localized slugs are excluded — per-locale derivation isn't
// supported.
function slugDerivations(collection: Collection, keys: ReadonlyArray<string>): SlugDerivations {
  const bySource: Record<string, string[]> = {};
  const derivable = new Set<string>();
  for (const key of keys) {
    const meta = collection.fields[key]?.meta as
      | { kind: string; localized?: boolean; from?: string }
      | undefined;
    if (meta?.kind !== "slug" || typeof meta.from !== "string" || meta.localized === true) continue;
    bySource[meta.from] = [...(bySource[meta.from] ?? []), key];
    derivable.add(key);
  }
  return { bySource, derivable };
}

/**
 * The text a slug derives from. A plain source is its own string; a LOCALIZED
 * source — the common case, since a title is usually translated — is a
 * per-locale record, and the slug follows the default locale, falling back to
 * the first locale carrying text. Without this a `slug({ from: "title" })` on a
 * localized title silently never derives, which is exactly what it used to do.
 * Mirrors the engine's own `deriveSlugFields`, so the browser and the server
 * agree on what the slug should be.
 */
function slugSourceText(value: unknown, defaultLocale: string | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const preferred = defaultLocale === undefined ? undefined : record[defaultLocale];
  if (typeof preferred === "string" && preferred !== "") return preferred;
  for (const text of Object.values(record)) {
    if (typeof text === "string" && text !== "") return text;
  }
  return undefined;
}

/** `n / max` for a bounded string, when the field declares a `max`. */
function charCount(value: unknown, meta: { max?: number }): string | undefined {
  if (typeof meta.max !== "number" || typeof value !== "string") return undefined;
  return `${value.length} / ${meta.max}`;
}

/** How long a "Saved" confirmation lingers under a per-field save. */
const SAVED_FLASH_MS = 2000;

export function CollectionForm<C extends Collection = Collection>({
  collection,
  defaultValues,
  fields,
  registry = defaultEditRegistry,
  displayRegistry,
  mode,
  locales,
  onSubmit,
  submitLabel: submitLabelProp,
  title,
  description,
  back,
  actions,
  width = "reading",
  error,
  serverErrors,
  activeGroup,
  onGroupChange,
  groupLayout = "section",
  defaultLocale,
  onDirtyChange,
  onValuesChange,
  onFocusPathChange,
  saveMode = "form",
}: CollectionFormProps<C>): ReactNode {
  const perField = saveMode === "field";
  const messages = useMessages();
  const submitLabel = submitLabelProp ?? messages.common.save;
  const formId = useId();
  const creating = (mode ?? (defaultValues === undefined ? "create" : "edit")) === "create";
  const keys = resolveFieldKeys(collection, fields, creating);
  // `readOnly` fields are shown, never edited: they sit outside dirtiness,
  // validation and every submitted payload (the REST layer rejects a write
  // naming one), so the rest of the form works off `editableKeys`.
  const readOnlyKeys = new Set(keys.filter((k) => collection.fields[k]?.meta.readOnly === true));
  const editableKeys = keys.filter((k) => !readOnlyKeys.has(k));
  const { bySource, derivable } = slugDerivations(collection, editableKeys);
  // Internally the form edits a loose record (widgets are kind-keyed, not
  // field-typed); the typed `FormValues<C>` surface lives only at the
  // `onSubmit` boundary, narrowed back once `validateFields` has run.
  const defaults = defaultValues ?? {};
  const [values, setValues] = useState<Doc>(() => ({ ...defaults }));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>(() => ({
    ...serverErrors,
  }));
  // Path-level issues under each failed field — what a structured widget
  // (blocks, array, object) needs to place a message next to the nested
  // control. Cleared together with the field's error.
  const [fieldIssues, setFieldIssues] = useState<
    Readonly<Record<string, ReadonlyArray<FieldIssue>>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  // Per-field save (`saveMode="field"`): which field is mid-save, which fields
  // have unsaved edits, and which just saved (for the brief confirmation).
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  // Dirtiness is DERIVED from a baseline, never accumulated — see `lib/dirty`.
  // A widget that normalises its value on mount (the rich-text editor does)
  // would otherwise mark an untouched form as edited.
  const [baseline, setBaseline] = useState<Doc>(() => ({ ...defaults }));
  useEffect(() => {
    if (savedField === null) return;
    const timer = setTimeout(() => setSavedField(null), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedField]);
  // Unsaved-changes guard: once the user edits a field, a full-page navigation
  // (reload / tab close / external link) prompts the native "leave site?"
  // confirm so in-progress input isn't lost silently. In-app router navigation
  // is the host's to block — `@voila/content-ui` stays router-agnostic — but
  // this covers the cases the component can see on its own. Cleared on a
  // successful submit (the values are persisted; leaving is now intended).
  const dirtyFields = dirtyFieldKeys(collection.fields, editableKeys, baseline, values);
  const hasUnsavedChanges = dirtyFields.size > 0;
  // Mirror the flag out to the host so it can block in-app router navigation
  // (this component can't — it stays router-agnostic).
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(hasUnsavedChanges);
  }, [hasUnsavedChanges]);
  // Leaving the form for good should not keep the host blocked.
  useEffect(() => {
    return () => onDirtyChangeRef.current?.(false);
  }, []);
  // Mirror the document out as it changes (live preview). Ref-held so a host
  // passing an inline arrow doesn't re-fire the effect on every render.
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;
  useEffect(() => {
    onValuesChangeRef.current?.(values);
  }, [values]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Legacy assignment some browsers still require to show the prompt.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
  // Adopt each new `serverErrors` object into the field errors during render
  // (the React "derive state from a prop change" pattern), so a failed submit's
  // 422/409 lands on the offending fields and clears on edit like local errors.
  const [prevServerErrors, setPrevServerErrors] = useState(serverErrors);
  if (serverErrors !== prevServerErrors) {
    setPrevServerErrors(serverErrors);
    if (serverErrors !== undefined) setErrors((prev) => ({ ...prev, ...serverErrors }));
  }
  // Derive-on-type latch: a slug follows its `from` source until it's edited
  // by hand — including arriving non-empty (an existing document). Clearing
  // the slug re-opens the latch so the next source edit re-derives.
  const [latchedSlugs, setLatchedSlugs] = useState<ReadonlySet<string>>(() => {
    const latched = new Set<string>();
    for (const key of derivable) {
      const v = defaults[key];
      if (typeof v === "string" && v !== "") latched.add(key);
    }
    return latched;
  });

  // Grouped layout (when the collection declares `groups`): one card holding
  // the active group's fields. The form keeps ONE shared values/errors/slug
  // state above — groups only partition which fields render, so validation and
  // submit still cover every field (and slug derivation works across groups).
  // The active group is internal state so a focus-driven switch (below) takes
  // effect immediately; the controlled `activeGroup` prop is synced into it.
  // Which translation the form is editing. One locale at a time keeps the form
  // the same height whether the project has two languages or ten.
  const [activeLocale, setActiveLocale] = useState<string | undefined>(
    () => defaultLocale ?? locales?.[0],
  );
  const multiLocale = (locales?.length ?? 0) > 1;
  const editingLocale =
    multiLocale && activeLocale !== undefined && locales?.includes(activeLocale)
      ? activeLocale
      : (defaultLocale ?? locales?.[0]);

  const grouped = (collection.groups?.length ?? 0) > 0;
  // Create shows every group at once — see `groupLayout`.
  const stacked = grouped && groupLayout === "all";
  // Groups partition the KEPT keys (a create drops its readOnly fields).
  const resolvedGroups = grouped
    ? resolveFieldGroups(collection, { fields: keys, generalLabel: messages.shell.generalGroup })
    : [];
  const firstGroupId = resolvedGroups[0]?.id;
  const [internalGroup, setInternalGroup] = useState<string | undefined>(
    activeGroup ?? firstGroupId,
  );
  const [prevActiveGroup, setPrevActiveGroup] = useState(activeGroup);
  if (activeGroup !== prevActiveGroup) {
    setPrevActiveGroup(activeGroup);
    if (activeGroup !== undefined) setInternalGroup(activeGroup);
  }
  const activeGroupId = resolvedGroups.some((g) => g.id === internalGroup)
    ? internalGroup
    : firstGroupId;
  const activeResolved = resolvedGroups.find((g) => g.id === activeGroupId);
  function selectGroup(id: string) {
    setInternalGroup(id);
    onGroupChange?.(id);
  }

  // Focus a field that lives in another group on a failed submit: switching to
  // its group mounts the input on the next render, so the focus is deferred to
  // this effect (the in-group case stays synchronous in `focusFirstError`).
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (pendingFocusId === null) return;
    document.getElementById(pendingFocusId)?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId]);

  // Server errors (a 422/409 on submit) can land on a field in a group that
  // isn't currently shown. Switch to the first such field's group so its inline
  // message is visible — the form-level mirror covers it regardless, but this
  // brings the user to the field.
  useEffect(() => {
    if (!grouped || stacked || serverErrors === undefined) return;
    const firstKey = keys.find((key) => serverErrors[key] !== undefined);
    if (firstKey === undefined) return;
    const target = resolvedGroups.find((group) => group.fieldKeys.includes(firstKey));
    if (target && target.id !== activeGroupId) selectGroup(target.id);
    // Only react to a new serverErrors object.
  }, [serverErrors]);

  function handleChange(name: string, value: unknown) {
    const derivedKeys = (bySource[name] ?? []).filter((k) => !latchedSlugs.has(k));
    setValues((prev) => {
      // A localized widget passes a functional updater so its per-locale edits
      // merge against the latest record, not the (possibly stale) value it was
      // rendered with — otherwise two locales emitting in one batch clobber each
      // other and a locale silently drops out of the record.
      const resolved =
        typeof value === "function" ? (value as (p: unknown) => unknown)(prev[name]) : value;
      const next = { ...prev, [name]: resolved };
      const source = slugSourceText(resolved, defaultLocale ?? locales?.[0]);
      if (source !== undefined) for (const k of derivedKeys) next[k] = slugify(source);
      return next;
    });
    if (derivable.has(name)) {
      setLatchedSlugs((prev) => {
        const latch = value !== "" && value !== undefined && value !== null;
        if (latch === prev.has(name)) return prev;
        const next = new Set(prev);
        if (latch) next.add(name);
        else next.delete(name);
        return next;
      });
    }
    // Clear a field's error as soon as the user edits it (and any slug just
    // re-derived from it), so stale messages don't linger while they fix the
    // problem.
    setErrors((prev) => {
      const stale = [name, ...derivedKeys].filter((k) => k in prev);
      if (stale.length === 0) return prev;
      const rest = { ...prev };
      for (const k of stale) delete rest[k];
      return rest;
    });
    setFieldIssues((prev) => {
      if (!(name in prev)) return prev;
      const rest = { ...prev };
      delete rest[name];
      return rest;
    });
  }

  // Move focus to the first field that failed validation, so a keyboard / AT
  // user lands on the problem instead of being left at the submit button. The
  // control's DOM id is the form's `${slug}-${key}` (the first locale's input
  // for a localized field); the elements are already rendered, so a synchronous
  // focus by id works.
  function focusFirstError(failed: Readonly<Record<string, string>>) {
    const firstKey = editableKeys.find((key) => failed[key] !== undefined);
    if (firstKey === undefined) return;
    const localized = collection.fields[firstKey]?.meta.localized === true && locales !== undefined;
    const id = `${collection.slug}-${firstKey}`;
    const targetId = localized ? `${id}-${locales?.[0]}` : id;
    // Stacked layout mounts every group, so there is never a group to switch to.
    if (grouped && !stacked) {
      const target = resolvedGroups.find((g) => g.fieldKeys.includes(firstKey));
      if (target && target.id !== activeGroupId) {
        selectGroup(target.id);
        setPendingFocusId(targetId);
        return;
      }
    }
    document.getElementById(targetId)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateFields(collection.fields, values, editableKeys, {
      locales,
      defaultLocale,
      messages,
    });
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      setFieldIssues(result.issues);
      focusFirstError(result.errors);
      return;
    }
    setErrors({});
    setFieldIssues({});
    setSubmitting(true);
    try {
      // `result.values` has cleared the fields' Standard Schemas, so it
      // conforms to the collection's typed shape — narrow back to `FormValues`.
      await onSubmit(result.values as FormValues<C>);
      // Only on success: a thrown `onSubmit` (e.g. a server conflict) leaves the
      // form mounted with the user's still-unsaved edits, so keep guarding it.
      // The submitted values become the clean baseline.
      setBaseline(values);
    } finally {
      setSubmitting(false);
    }
  }

  // Per-field save: validate + submit just this field as a one-key partial. A
  // failed field surfaces its error inline and takes focus; a clean save clears
  // the field's unsaved flag and flashes "Saved".
  async function submitField(key: string) {
    if (readOnlyKeys.has(key)) return;
    const result = validateFields(collection.fields, values, [key], {
      locales,
      defaultLocale,
      messages,
    });
    if (result.errors[key] !== undefined) {
      setErrors((prev) => ({ ...prev, [key]: result.errors[key] as string }));
      setFieldIssues((prev) => ({ ...prev, [key]: result.issues[key] ?? [] }));
      const localized = collection.fields[key]?.meta.localized === true && locales !== undefined;
      const base = `${collection.slug}-${key}`;
      document.getElementById(localized ? `${base}-${locales?.[0]}` : base)?.focus();
      return;
    }
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    setSavingField(key);
    try {
      // A cleared optional field validates to an OMITTED key; send an explicit
      // null so the PATCH actually clears it (an absent key is a no-op server-side).
      const value = key in result.values ? result.values[key] : null;
      await onSubmit({ [key]: value } as FormValues<C>);
      // Only this field is clean now; the rest keep their unsaved state.
      setBaseline((prev) => ({ ...prev, [key]: values[key] }));
      setSavedField(key);
    } finally {
      setSavingField(null);
    }
  }

  // One field's label + widget + help text + inline error, shared by every
  // layout. In per-field mode a dirty field grows an inline Save row.
  function renderField(key: string): ReactNode {
    const field = collection.fields[key];
    if (!field) return null;
    const id = `${collection.slug}-${key}`;
    // A readOnly field keeps its place in the layout but renders its DISPLAY
    // widget — no input, no dirty marker, no per-field Save.
    if (readOnlyKeys.has(key)) {
      return (
        <FieldRow key={key} id={id} label={getFieldLabel(key, field)} help={field.meta.description}>
          <div data-slot="readonly-field" className="text-sm">
            <FieldRenderer
              field={field}
              value={values[key]}
              registry={displayRegistry}
              context="detail"
            />
          </div>
        </FieldRow>
      );
    }
    const fieldError = errors[key];
    const required = field.meta.required === true;
    // In per-field mode, lock the field's input while its own save is in flight
    // (otherwise a mid-save edit would be clobbered when the save clears dirty).
    const fieldDisabled = submitting || savingField === key;
    const localized = field.meta.localized === true && locales !== undefined;
    const Widget = localized ? null : resolveEditWidget(field.meta, registry);
    // For a failed localized field, resolve the message down to the locale(s)
    // that actually failed so the error doesn't repeat under every locale.
    const localeErrors =
      localized && fieldError !== undefined
        ? localizedFieldErrors(field, values[key], locales ?? [], defaultLocale, messages)
        : undefined;
    const hasLocaleErrors = localeErrors !== undefined && Object.keys(localeErrors).length > 0;
    const help = field.meta.description;
    const count = localized ? undefined : charCount(values[key], field.meta as { max?: number });
    // `data-dirty` marks any changed field (a hook for tests and for anyone
    // debugging a form that thinks it has edits); only per-field mode grows the
    // inline Save row from it.
    const changed = dirtyFields.has(key);
    const isDirty = perField && changed;
    const saving = savingField === key;
    const justSaved = savedField === key;
    const saveRow =
      perField && (isDirty || saving || justSaved) ? (
        <div
          data-slot="field-save"
          className="flex items-center justify-end gap-2 text-muted-foreground text-xs"
        >
          {justSaved && !isDirty ? (
            <span role="status">{messages.common.saved}</span>
          ) : (
            <>
              <span>{messages.form.unsavedChanges}</span>
              <Button
                type="button"
                size="xs"
                disabled={saving || !isDirty}
                onClick={() => submitField(key)}
              >
                {saving ? messages.common.saving : submitLabel}
              </Button>
            </>
          )}
        </div>
      ) : null;
    return (
      <FieldRow
        key={key}
        id={id}
        htmlFor={localized ? `${id}-${locales?.[0]}` : id}
        label={getFieldLabel(key, field)}
        required={required}
        count={count}
        help={help}
        error={fieldError}
        // Suppressed for a localized field once its per-locale errors render
        // inline, to avoid showing it twice.
        hideError={hasLocaleErrors}
        dirty={changed}
        trailer={saveRow}
      >
        {localized ? (
          <LocalizedFieldEditor
            field={field}
            locales={locales ?? []}
            value={values[key]}
            onChange={(v) => handleChange(key, v)}
            id={id}
            labelId={`${id}-label`}
            registry={registry}
            errors={localeErrors}
            disabled={fieldDisabled}
            activeLocale={multiLocale ? editingLocale : undefined}
            fallbackLocale={defaultLocale ?? locales?.[0]}
          />
        ) : Widget ? (
          <FocusPathProvider path={[key]} onChange={onFocusPathChange}>
            <Widget
              value={values[key]}
              onChange={(v) => handleChange(key, v)}
              field={field}
              id={id}
              labelId={`${id}-label`}
              error={fieldError}
              issues={fieldIssues[key]}
              disabled={fieldDisabled}
            />
          </FocusPathProvider>
        ) : null}
      </FieldRow>
    );
  }

  // The field keys actually mounted right now: every eligible field in the flat
  // layout, but only the ACTIVE group's fields when grouped. An error keyed to
  // an unmounted field (a hidden field, or — when grouped — a field in another
  // group) renders nowhere inline, so it must surface form-level.
  const renderedKeys = grouped && activeResolved && !stacked ? activeResolved.fieldKeys : keys;
  const formLevelErrors = Object.entries(errors)
    .filter(([key]) => !renderedKeys.includes(key))
    .map(([key, message]) => (
      <p key={key} role="alert" className="text-destructive text-sm">
        {humanize(key)}: {message}
      </p>
    ));
  const formError = error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;

  // The pinned page header. In `form` mode the submit button lives here (a
  // native submit bound to the `<form>` by id, so Enter in a field still
  // submits); in `field` mode the host's actions (Done) stand alone.
  const submitButton = perField ? null : (
    <Button type="submit" form={formId} disabled={submitting} size="sm">
      {submitting ? `${submitLabel}…` : submitLabel}
    </Button>
  );
  const hasHeader = title !== undefined || description !== undefined || actions !== undefined;
  const header = hasHeader ? (
    <PageLayout.Header
      back={back}
      actions={
        <>
          {actions}
          {submitButton}
        </>
      }
    >
      {title !== undefined ? <PageLayout.Title>{title}</PageLayout.Title> : null}
      {description !== undefined ? (
        <PageLayout.Description>{description}</PageLayout.Description>
      ) : null}
    </PageLayout.Header>
  ) : null;

  // Per-locale completion across the localized fields the form renders — the
  // dots on the switcher, so an editor can see at a glance which language is
  // still missing work without clicking through every tab.
  const localeProgress = ((): Readonly<Record<string, LocaleProgress>> | undefined => {
    if (!multiLocale || locales === undefined) return undefined;
    const localizedKeys = editableKeys.filter(
      (key) => collection.fields[key]?.meta.localized === true,
    );
    if (localizedKeys.length === 0) return undefined;
    const out: Record<string, LocaleProgress> = {};
    for (const locale of locales) {
      let filled = 0;
      for (const key of localizedKeys) {
        const record = values[key];
        if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
        const value = (record as Record<string, unknown>)[locale];
        if (value !== undefined && value !== null && value !== "") filled += 1;
      }
      out[locale] = { locale, filled, total: localizedKeys.length };
    }
    return out;
  })();

  const localeSwitcher =
    multiLocale && locales !== undefined && editingLocale !== undefined && localeProgress ? (
      <LocaleSwitcher
        locales={locales}
        value={editingLocale}
        onChange={setActiveLocale}
        defaultLocale={defaultLocale ?? locales[0]}
        progress={localeProgress}
        disabled={submitting}
      />
    ) : null;

  const strip =
    grouped && activeResolved && !stacked ? (
      <FieldGroupNav
        groups={resolvedGroups}
        activeGroup={activeResolved.id}
        onSelect={selectGroup}
      />
    ) : null;

  // The body card: the active group's fields (or every field, flat) in ONE
  // closed card, with the group description on top and any errors at the foot.
  const bodyKeys = grouped && activeResolved && !stacked ? activeResolved.fieldKeys : keys;
  const trailer = (
    <>
      {formLevelErrors}
      {formError}
      {/* Without a header there's no header button, so the bare form keeps a
          submit of its own. */}
      {!perField && !hasHeader ? (
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      ) : null}
    </>
  );
  // Stacked: every group is its own titled card, so a new record's fields are
  // all reachable without a nav that only exists once the record does.
  const card = stacked ? (
    <div data-slot="form-sections" className="space-y-6">
      {resolvedGroups.map((group) => (
        <FieldCard.Root key={group.id} id={`${collection.slug}-group-${group.id}`}>
          <FieldCard.Card className="space-y-5 p-5 sm:p-6">
            <div>
              <FieldCard.Title className="text-base">{group.label}</FieldCard.Title>
              {group.description ? (
                <FieldCard.Description className="mt-1 mb-0">
                  {group.description}
                </FieldCard.Description>
              ) : null}
            </div>
            {group.fieldKeys.map(renderField)}
          </FieldCard.Card>
        </FieldCard.Root>
      ))}
      {trailer}
    </div>
  ) : (
    <FieldCard.Root>
      <FieldCard.Card className="space-y-5 p-5 sm:p-6">
        {activeResolved?.description ? (
          <FieldCard.Description className="my-0">
            {activeResolved.description}
          </FieldCard.Description>
        ) : null}
        {bodyKeys.map(renderField)}
        {trailer}
      </FieldCard.Card>
    </FieldCard.Root>
  );

  const body = (
    <PageLayout.Body width={width}>
      {localeSwitcher}
      {card}
    </PageLayout.Body>
  );

  // Per-field mode: no wrapping `<form>` — every field saves independently.
  if (perField) {
    return (
      <EditRegistryProvider registry={registry}>
        <PageLayout.Root data-slot="collection-form" data-dirty={hasUnsavedChanges || undefined}>
          {header}
          {strip}
          {body}
        </PageLayout.Root>
      </EditRegistryProvider>
    );
  }

  // Form mode: the `<form>` uses `display:contents` so it doesn't break the page
  // frame's flex column; the header submit targets it by id.
  return (
    <EditRegistryProvider registry={registry}>
      <PageLayout.Root data-slot="collection-form" data-dirty={hasUnsavedChanges || undefined}>
        {header}
        {strip}
        <form id={formId} onSubmit={handleSubmit} noValidate className={cn("contents")}>
          {body}
        </form>
      </PageLayout.Root>
    </EditRegistryProvider>
  );
}
