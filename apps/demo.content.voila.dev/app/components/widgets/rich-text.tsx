// RichTextInput — the edit widget for `richText` *and* `markdown` fields. It
// bridges the engine's stored value to the Plate editor and back through the
// canonical `@voila/rich-text-editor` adapters, so this file stays thin glue you
// can own and restyle. One widget, two value models:
//
//   • `richText` stores a validated JSON node tree. We map it to the editor with
//     `fromWire`/`toWire`; the plugin set is derived from the field's allowed
//     `elements`/`marks`, so a restricted field gets a restricted editor for
//     free and any node kind the editor can't edit rides through untouched.
//   • `markdown` stores a string. We deserialize it once on mount and serialize
//     back to markdown on change (`fromMarkdown`/`toMarkdown`), honoring the
//     field's `flavor`. `mdx` can't round-trip, so it stays a raw textarea; for
//     `commonmark`/`gfm` a toggle keeps the raw source one click away.
//
// This demo copy also wires the `/` slash menu and `@`-mentions — mentions need
// a runtime source, so the items live here (your app owns this file). Swap the
// static list for a query against your own users/posts.

import type { rt } from "@voila/content";
import type { EditWidgetProps } from "@voila/content-ui";
import {
  RichTextEditor,
  RichTextFloatingToolbar,
  RichTextImageButton,
  RichTextToolbar,
} from "@voila/rich-text-editor";
import {
  deriveMarkdownPlugins,
  deriveMarkdownToolbar,
  derivePlugins,
  deriveToolbar,
  fromWire,
  type MediaOptions,
  type MentionItem,
  toWire,
} from "@voila/rich-text-editor/content";
import { fromMarkdown, type MarkdownFlavor, toMarkdown } from "@voila/rich-text-editor/serialize";
import "@voila/rich-text-editor/styles.css";
import { cn } from "@voila/ui/cn";
import { Textarea } from "@voila/ui/textarea";
import { type ReactNode, useMemo, useState } from "react";
import { mediaClient } from "../../lib/content-client";

/** The `richText` field's `meta` carries the allowed element/mark kinds. */
interface RichTextMeta {
  readonly elements?: ReadonlyArray<string>;
  readonly marks?: ReadonlyArray<string>;
}

/** The `markdown` field's `meta` carries the dialect (and optional placeholder). */
interface MarkdownMeta {
  readonly flavor?: MarkdownFlavor | "mdx";
  readonly description?: string;
}

/** People a writer can @-mention. In a real app, fetch these from a collection. */
const MENTION_ITEMS: ReadonlyArray<MentionItem> = [
  { value: "ada", label: "Ada Lovelace" },
  { value: "alan", label: "Alan Turing" },
  { value: "grace", label: "Grace Hopper" },
  { value: "linus", label: "Linus Torvalds" },
];

/** Uploads an image through the `_media` pipeline; its `url` is stored on the
 *  inserted image node. The editor stays data-agnostic — the host owns this. */
const MEDIA: MediaOptions = {
  upload: (file) =>
    mediaClient.upload(file).then((m) => ({
      url: m.url,
      alt: m.alt,
      width: m.width,
      height: m.height,
    })),
};

/** A stored richText value is an array of elements; anything else starts empty. */
function asValue(value: unknown): rt.RichTextValue {
  return Array.isArray(value) ? (value as rt.RichTextValue) : [];
}

/** `aria-invalid` + `aria-describedby` wiring, matching the native widgets. */
function aria(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : undefined;
}

/**
 * The bordered, focusable container that makes the toolbar + editable surface
 * read as one form field — same border/ring/shadow as the native `Input` and
 * `Textarea`, so a rich field doesn't look loose next to them. Error lights the
 * border red; disabled dims and inerts it.
 */
function EditorShell({
  error,
  disabled,
  children,
}: {
  readonly error?: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div
      data-invalid={error ? "" : undefined}
      className={cn(
        "voila-editor-shell rounded-md border border-input bg-transparent shadow-sm",
        "transition-colors focus-within:ring-1 focus-within:ring-ring",
        error && "border-destructive focus-within:ring-destructive",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The header strip atop the editable: the formatting toolbar on the left and an
 * optional control on the right (the markdown raw/rich switch). One muted bar
 * with a single divider underneath, rounded to nest inside the shell border.
 */
function EditorHeader({
  children,
  aside,
}: {
  readonly children: ReactNode;
  readonly aside?: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-stretch rounded-t-[5px] border-b bg-muted/40">
      <div className="min-w-0 flex-1">{children}</div>
      {aside ? <div className="flex items-center border-l px-1.5">{aside}</div> : null}
    </div>
  );
}

/** A two-option segmented switch — clearer than a single toggle button, it shows
 *  which mode is active and what the alternative is in one glance. */
function ModeSwitch({
  raw,
  onChange,
  disabled,
}: {
  readonly raw: boolean;
  readonly onChange: (raw: boolean) => void;
  readonly disabled?: boolean;
}): ReactNode {
  return (
    <fieldset
      aria-label="Editor mode"
      className="m-0 flex items-center gap-0.5 border-0 p-0 text-xs font-medium"
    >
      <ModeButton active={!raw} onClick={() => onChange(false)} disabled={disabled}>
        Rich
      </ModeButton>
      <ModeButton active={raw} onClick={() => onChange(true)} disabled={disabled}>
        Markdown
      </ModeButton>
    </fieldset>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-sm px-2 py-1 transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {children}
    </button>
  );
}

export function RichTextInput(props: EditWidgetProps): ReactNode {
  return props.field.meta.kind === "markdown" ? (
    <MarkdownInput {...props} />
  ) : (
    <RichTextValueInput {...props} />
  );
}

function RichTextValueInput({
  value,
  onChange,
  field,
  id,
  labelId,
  error,
  disabled,
}: EditWidgetProps): ReactNode {
  const meta = field.meta as RichTextMeta;
  const elements = meta.elements ?? [];
  const marks = meta.marks ?? [];
  // `slash` wires the `/` command menu (gated to the field's blocks); `mention`
  // enables `@`-mentions when the field allows the `mention` element kind;
  // `media` enables image upload + drop/paste when the field allows `image`.
  const { plugins, components } = useMemo(
    () =>
      derivePlugins(elements, marks, {
        slash: true,
        mention: { source: "users", items: MENTION_ITEMS },
        media: MEDIA,
      }),
    [elements, marks],
  );
  const toolbar = useMemo(() => deriveToolbar(elements, marks), [elements, marks]);
  // The insert-image control only appears when the field can hold images.
  const canInsertImage = elements.includes("image");
  // `value` only seeds the editor's initial state — Plate owns it after mount and
  // doesn't re-read this, so live prop changes never fight the cursor. The form
  // remounts the widget per document, so the value at mount is the right one.
  const initial = useMemo(() => fromWire(asValue(value)), [value]);

  return (
    <EditorShell error={error} disabled={disabled}>
      <RichTextEditor
        value={initial}
        onChange={(next) => onChange(toWire(next))}
        plugins={plugins}
        components={components}
        placeholder="Write something, or press / for commands, @ to mention…"
        toolbar={
          <>
            <EditorHeader>
              <RichTextToolbar
                model={toolbar}
                className="voila-rich-text-toolbar voila-toolbar-bare"
                extra={canInsertImage ? <RichTextImageButton upload={MEDIA.upload} /> : undefined}
              />
            </EditorHeader>
            <RichTextFloatingToolbar model={toolbar} />
          </>
        }
        readOnly={disabled}
        id={id}
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </EditorShell>
  );
}

function MarkdownInput({
  value,
  onChange,
  field,
  id,
  labelId,
  error,
  disabled,
}: EditWidgetProps): ReactNode {
  const meta = field.meta as MarkdownMeta;
  const flavor = meta.flavor ?? "gfm";
  const text = typeof value === "string" ? value : "";
  // MDX mixes JSX into markdown and can't round-trip through the rich editor, so
  // it never leaves the raw textarea (`richFlavor` is null). Other flavors start
  // rich with a toggle back to the raw source.
  const richFlavor: MarkdownFlavor | null = flavor === "mdx" ? null : flavor;
  const [raw, setRaw] = useState(richFlavor === null);

  if (raw || richFlavor === null) {
    // Raw source: the same shell, but the header carries a plain label (no
    // formatting controls apply to a textarea) plus the mode switch — so the
    // toggle lives in one consistent place across both modes.
    return (
      <EditorShell error={error} disabled={disabled}>
        <EditorHeader
          aside={
            richFlavor !== null ? (
              <ModeSwitch raw onChange={setRaw} disabled={disabled} />
            ) : undefined
          }
        >
          <span className="px-2.5 py-2 text-xs font-medium text-muted-foreground">
            {richFlavor === null ? "MDX source" : "Markdown source"}
          </span>
        </EditorHeader>
        <Textarea
          id={id}
          className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
          value={text}
          placeholder={meta.description}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-labelledby={labelId}
          {...aria(id, error)}
        />
      </EditorShell>
    );
  }

  return (
    <MarkdownRichEditor
      text={text}
      flavor={richFlavor}
      onChange={onChange}
      onRaw={() => setRaw(true)}
      id={id}
      labelId={labelId}
      error={error}
      disabled={disabled}
    />
  );
}

interface MarkdownRichEditorProps {
  readonly text: string;
  readonly flavor: MarkdownFlavor;
  readonly onChange: (value: unknown) => void;
  /** Switch back to the raw markdown source (the header's mode switch). */
  readonly onRaw: () => void;
  readonly id: string;
  readonly labelId?: string;
  readonly error?: string;
  readonly disabled?: boolean;
}

function MarkdownRichEditor({
  text,
  flavor,
  onChange,
  onRaw,
  id,
  labelId,
  error,
  disabled,
}: MarkdownRichEditorProps): ReactNode {
  const { plugins, components } = useMemo(() => deriveMarkdownPlugins(flavor), [flavor]);
  const toolbar = useMemo(() => deriveMarkdownToolbar(flavor), [flavor]);
  // Deserialize once: the editor owns its value after mount, so we never re-parse
  // `text` on every keystroke (that would reset the cursor). Toggling to raw and
  // back remounts this component, so a raw-mode edit is re-read here.
  const initial = useMemo(() => fromMarkdown(text, { flavor }), [text, flavor]);

  return (
    <EditorShell error={error} disabled={disabled}>
      <RichTextEditor
        value={initial}
        // Serialize straight back to a markdown string so the form value stays the
        // stored shape and re-validates against the field's own schema.
        onChange={(next) => onChange(toMarkdown(next, { flavor }))}
        plugins={plugins}
        components={components}
        toolbar={
          <>
            <EditorHeader
              aside={
                <ModeSwitch
                  raw={false}
                  onChange={(toRaw) => toRaw && onRaw()}
                  disabled={disabled}
                />
              }
            >
              <RichTextToolbar
                model={toolbar}
                className="voila-rich-text-toolbar voila-toolbar-bare"
              />
            </EditorHeader>
            <RichTextFloatingToolbar model={toolbar} />
          </>
        }
        readOnly={disabled}
        id={id}
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </EditorShell>
  );
}
