// CollectionForm — builds a create/edit form from a collection's fields. Each
// field renders its edit widget (resolved from the registry); on submit the
// values are validated against the fields' Standard Schemas via `validateFields`
// (the same contract the REST write path enforces) and, only if clean, handed
// to `onSubmit` decoded. Field errors render inline; a form-level `error` slot
// surfaces server failures (e.g. a 409 conflict).

import { type Collection, type InferFields, slugify } from "@voila/content";
import { buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { Label } from "@voila/ui/label";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { FieldCard } from "./field-card";
import { FieldGroupNav } from "./field-group-nav";
import type { Doc } from "./lib/doc";
import { resolveFieldGroups } from "./lib/groups";
import { getFieldLabel, humanize } from "./lib/humanize";
import { localizedFieldErrors, validateFields } from "./lib/validate";
import { LocalizedFieldEditor } from "./localized-field";
import { defaultEditRegistry, type EditRegistry, resolveEditWidget } from "./registry/edit";

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
   * The project's locales (`config.i18n.locales`). When set, localized fields
   * render one input per locale (admin translation); without it they fall back
   * to the kind's plain widget editing the raw record.
   */
  readonly locales?: ReadonlyArray<string>;
  /** Called with the decoded, validated values when the form is submitted. */
  readonly onSubmit: (values: FormValues<C>) => void | Promise<void>;
  readonly submitLabel?: string;
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
   * form renders a left sub-nav + one card per group, with a single Save in the
   * active group's footer that submits (and validates) the whole form. Optional
   * and controlled — omit it and the form tracks its own active group,
   * defaulting to the first. Ignored when the collection has no `groups`.
   */
  readonly activeGroup?: string;
  /** Called with a group id when the user picks one in the sub-nav. */
  readonly onGroupChange?: (id: string) => void;
  /**
   * How the form saves:
   * - `"form"` (default) — one Save validates and submits every rendered field
   *   at once (the whole form, or the whole active group's worth in one
   *   `onSubmit`).
   * - `"field"` — each field is its own card with its own Save, which validates
   *   and submits just that field as a partial update. `onSubmit` receives a
   *   one-key document, so it only suits a PATCH-style update (collections, not
   *   the singleton's full-document `set`).
   */
  readonly saveMode?: "form" | "field";
}

function resolveFieldKeys(collection: Collection, fields?: ReadonlyArray<string>): string[] {
  if (fields) return fields.filter((k) => Object.hasOwn(collection.fields, k));
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
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

export function CollectionForm<C extends Collection = Collection>({
  collection,
  defaultValues,
  fields,
  registry = defaultEditRegistry,
  locales,
  onSubmit,
  submitLabel = "Save",
  error,
  serverErrors,
  activeGroup,
  onGroupChange,
  saveMode = "form",
}: CollectionFormProps<C>): ReactNode {
  const perField = saveMode === "field";
  const keys = resolveFieldKeys(collection, fields);
  const { bySource, derivable } = slugDerivations(collection, keys);
  // Internally the form edits a loose record (widgets are kind-keyed, not
  // field-typed); the typed `FormValues<C>` surface lives only at the
  // `onSubmit` boundary, narrowed back once `validateFields` has run.
  const defaults = defaultValues ?? {};
  const [values, setValues] = useState<Doc>(() => ({ ...defaults }));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>(() => ({
    ...serverErrors,
  }));
  const [submitting, setSubmitting] = useState(false);
  // Per-field save (`saveMode="field"`): which field is mid-save, and which
  // fields have unsaved edits — each card's footer reads these for its own Save.
  const [savingField, setSavingField] = useState<string | null>(null);
  const [dirtyFields, setDirtyFields] = useState<ReadonlySet<string>>(() => new Set());
  // Unsaved-changes guard: once the user edits a field, a full-page navigation
  // (reload / tab close / external link) prompts the native "leave site?"
  // confirm so in-progress input isn't lost silently. In-app router navigation
  // is the host's to block — `@voila/content-ui` stays router-agnostic — but
  // this covers the cases the component can see on its own. Cleared on a
  // successful submit (the values are persisted; leaving is now intended).
  const [dirty, setDirty] = useState(false);
  // Whether there are unsaved edits. In per-field mode each card saves on its own
  // (there's no whole-form submit to clear `dirty`), so the guard tracks the
  // per-field `dirtyFields` set, which a successful per-field save empties.
  const hasUnsavedChanges = perField ? dirtyFields.size > 0 : dirty;
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

  // Grouped layout (when the collection declares `groups`): a left sub-nav + one
  // card holding the active group's fields, with a single Save that submits the
  // whole form. The form keeps ONE shared values/errors/slug state above —
  // groups only partition which fields render, so validation and submit still
  // cover every field (and slug derivation works across groups). The active
  // group is internal state so a focus-driven switch (below) takes effect
  // immediately; the controlled `activeGroup` prop is synced into it.
  const grouped = (collection.groups?.length ?? 0) > 0;
  const resolvedGroups = grouped ? resolveFieldGroups(collection, { fields }) : [];
  const firstGroupId = resolvedGroups[0]?.id;
  // Seed from the controlled prop so it's honored on the first render too (the
  // sync below only fires on subsequent prop changes); fall back to the first
  // group when uncontrolled.
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
  // brings the user to the field. Runs after render, so the parent
  // `onGroupChange` call is safe.
  useEffect(() => {
    if (!grouped || serverErrors === undefined) return;
    const firstKey = keys.find((key) => serverErrors[key] !== undefined);
    if (firstKey === undefined) return;
    const target = resolvedGroups.find((group) => group.fieldKeys.includes(firstKey));
    if (target && target.id !== activeGroupId) selectGroup(target.id);
    // Only react to a new serverErrors object.
  }, [serverErrors]);

  function handleChange(name: string, value: unknown) {
    setDirty(true);
    const derivedKeys = (bySource[name] ?? []).filter((k) => !latchedSlugs.has(k));
    // Track the edited field (+ any slug just re-derived from it) as unsaved, so
    // each per-field card knows whether to enable its Save.
    if (perField) {
      setDirtyFields((prev) => {
        const next = new Set(prev);
        next.add(name);
        for (const k of derivedKeys) next.add(k);
        return next;
      });
    }
    setValues((prev) => {
      // A localized widget passes a functional updater so its per-locale edits
      // merge against the latest record, not the (possibly stale) value it was
      // rendered with — otherwise two locales emitting in one batch clobber each
      // other and a locale silently drops out of the record.
      const resolved =
        typeof value === "function" ? (value as (p: unknown) => unknown)(prev[name]) : value;
      const next = { ...prev, [name]: resolved };
      if (typeof resolved === "string") for (const k of derivedKeys) next[k] = slugify(resolved);
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
  }

  // Move focus to the first field that failed validation, so a keyboard / AT
  // user lands on the problem instead of being left at the submit button. The
  // control's DOM id is the form's `${slug}-${key}` (the first locale's input
  // for a localized field); the elements are already rendered, so a synchronous
  // focus by id works.
  function focusFirstError(failed: Readonly<Record<string, string>>) {
    const firstKey = keys.find((key) => failed[key] !== undefined);
    if (firstKey === undefined) return;
    const localized = collection.fields[firstKey]?.meta.localized === true && locales !== undefined;
    const id = `${collection.slug}-${firstKey}`;
    const targetId = localized ? `${id}-${locales?.[0]}` : id;
    // Grouped: if the first failed field lives in another group, switch to it
    // and defer the focus until it's mounted (next render). Otherwise the
    // control is already on-screen, so focus it synchronously.
    if (grouped) {
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
    const result = validateFields(collection.fields, values, keys);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // `result.values` has cleared the fields' Standard Schemas, so it
      // conforms to the collection's typed shape — narrow back to `FormValues`.
      await onSubmit(result.values as FormValues<C>);
      // Only on success: a thrown `onSubmit` (e.g. a server conflict) leaves the
      // form mounted with the user's still-unsaved edits, so keep guarding it.
      setDirty(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Per-field save: validate + submit just this field as a one-key partial. A
  // failed field surfaces its error inline and takes focus; a clean save clears
  // the field's unsaved flag. The slug it derives (if any) is a separate card
  // the user saves on its own.
  async function submitField(key: string) {
    const result = validateFields(collection.fields, values, [key]);
    if (result.errors[key] !== undefined) {
      setErrors((prev) => ({ ...prev, [key]: result.errors[key] as string }));
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
      setDirtyFields((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setSavingField(null);
    }
  }

  // One field's label + widget + inline error, shared by the flat and grouped
  // layouts. `keys` order drives the flat layout; a group's `fieldKeys` order
  // drives the grouped one.
  function renderField(key: string): ReactNode {
    const field = collection.fields[key];
    if (!field) return null;
    const id = `${collection.slug}-${key}`;
    const fieldError = errors[key];
    const required = field.meta.required === true;
    // In per-field mode, lock the field's input while its own save is in flight
    // (otherwise a mid-save edit would be clobbered when the save clears dirty).
    const fieldDisabled = submitting || savingField === key;
    const localized = field.meta.localized === true && locales !== undefined;
    const Widget = localized ? null : resolveEditWidget(field.meta, registry);
    // For a failed localized field, resolve the message down to the locale(s)
    // that actually failed so the error doesn't repeat under every locale.
    // Empty (e.g. a server error client validation can't reproduce) → fall
    // back to the single field-level message below.
    const localeErrors =
      localized && fieldError !== undefined
        ? localizedFieldErrors(field, values[key], locales ?? [])
        : undefined;
    const hasLocaleErrors = localeErrors !== undefined && Object.keys(localeErrors).length > 0;
    return (
      <div key={key} className="space-y-1.5">
        <Label id={`${id}-label`} htmlFor={localized ? `${id}-${locales?.[0]}` : id}>
          {getFieldLabel(key, field)}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
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
          />
        ) : Widget ? (
          <Widget
            value={values[key]}
            onChange={(v) => handleChange(key, v)}
            field={field}
            id={id}
            labelId={`${id}-label`}
            error={fieldError}
            disabled={fieldDisabled}
          />
        ) : null}
        {/* Field-level message — suppressed for a localized field once its
            per-locale errors render inline, to avoid showing it twice. */}
        {fieldError && !hasLocaleErrors ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        ) : null}
      </div>
    );
  }

  // The field keys actually mounted right now: every eligible field in the flat
  // layout, but only the ACTIVE group's fields when grouped. An error keyed to
  // an unmounted field (a hidden field, or — when grouped — a field in another
  // group) renders nowhere inline, so it must surface form-level.
  const renderedKeys = grouped && activeResolved ? activeResolved.fieldKeys : keys;
  const formLevelErrors = Object.entries(errors)
    .filter(([key]) => !renderedKeys.includes(key))
    .map(([key, message]) => (
      <p key={key} role="alert" className="text-sm text-destructive">
        {humanize(key)}: {message}
      </p>
    ));
  const formError = error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

  // Per-field card: one field with its own footer Save (`saveMode="field"`).
  function renderFieldCard(key: string): ReactNode {
    if (!collection.fields[key]) return null;
    const isDirty = dirtyFields.has(key);
    const saving = savingField === key;
    return (
      <FieldCard.Root key={key}>
        <FieldCard.Body>{renderField(key)}</FieldCard.Body>
        <FieldCard.Footer>
          <FieldCard.FooterDescription>
            {isDirty ? "Unsaved changes" : ""}
          </FieldCard.FooterDescription>
          <button
            type="button"
            disabled={saving || !isDirty}
            onClick={() => submitField(key)}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {saving ? "Saving…" : submitLabel}
          </button>
        </FieldCard.Footer>
      </FieldCard.Root>
    );
  }

  // Per-field grouped layout: the sub-nav beside the active group's fields, each
  // its own card + Save. No wrapping `<form>` — every card saves independently.
  if (grouped && activeResolved && perField) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <FieldGroupNav
          groups={resolvedGroups}
          activeGroup={activeResolved.id}
          onSelect={selectGroup}
          title="Sections"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-xl">{activeResolved.label}</h2>
            {activeResolved.description ? (
              <p className="text-muted-foreground text-xs">{activeResolved.description}</p>
            ) : null}
          </div>
          {activeResolved.fieldKeys.map(renderFieldCard)}
          {formLevelErrors}
          {formError}
        </div>
      </div>
    );
  }

  // Per-field flat layout: every field its own card + Save.
  if (perField) {
    return (
      <div className="space-y-4">
        {keys.map(renderFieldCard)}
        {formLevelErrors}
        {formError}
      </div>
    );
  }

  // Grouped layout: a left sub-nav + the active group's fields in a card, with a
  // single Save in the footer that submits (and validates) the whole form.
  if (grouped && activeResolved) {
    return (
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <FieldGroupNav
            groups={resolvedGroups}
            activeGroup={activeResolved.id}
            onSelect={selectGroup}
            title="Sections"
          />
          <div className="min-w-0 flex-1">
            <FieldCard.Root>
              <FieldCard.Body className="space-y-4">
                <div className="space-y-1">
                  <FieldCard.Title>{activeResolved.label}</FieldCard.Title>
                  {activeResolved.description ? (
                    <FieldCard.Description>{activeResolved.description}</FieldCard.Description>
                  ) : null}
                </div>
                {activeResolved.fieldKeys.map(renderField)}
                {formLevelErrors}
                {formError}
              </FieldCard.Body>
              <FieldCard.Footer>
                <FieldCard.FooterDescription>
                  {dirty ? "Unsaved changes" : ""}
                </FieldCard.FooterDescription>
                {/* Native submit button (not `FieldCard.Button`): the @voila/ui
                    Button keeps its own `type="button"`, which wouldn't submit. */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  {submitLabel}
                </button>
              </FieldCard.Footer>
            </FieldCard.Root>
          </div>
        </div>
      </form>
    );
  }

  // Flat layout (no `groups`): every field stacked, one submit button.
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {keys.map(renderField)}
      {formLevelErrors}
      {formError}
      {/* A native submit button so pressing Enter / clicking submits the form;
          styled with the @voila/ui button tokens. */}
      <button type="submit" disabled={submitting} className={cn(buttonVariants())}>
        {submitLabel}
      </button>
    </form>
  );
}
