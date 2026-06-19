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

import type { rt } from "@voila/content";
import type { EditWidgetProps } from "@voila/content-ui";
import { RichTextEditor, RichTextFloatingToolbar, RichTextToolbar } from "@voila/rich-text-editor";
import {
  deriveMarkdownPlugins,
  deriveMarkdownToolbar,
  derivePlugins,
  deriveToolbar,
  fromWire,
  toWire,
} from "@voila/rich-text-editor/content";
import { fromMarkdown, type MarkdownFlavor, toMarkdown } from "@voila/rich-text-editor/serialize";
import "@voila/rich-text-editor/styles.css";
import { Button, Textarea } from "@voila/ui";
import { type ReactNode, useMemo, useState } from "react";

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

/** A stored richText value is an array of elements; anything else starts empty. */
function asValue(value: unknown): rt.RichTextValue {
  return Array.isArray(value) ? (value as rt.RichTextValue) : [];
}

/** `aria-invalid` + `aria-describedby` wiring, matching the native widgets. */
function aria(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : undefined;
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
  // `slash: true` wires the `/` command menu, gated to the field's allowed
  // blocks. To enable @-mentions, pass `{ ..., mention: { source, items } }`.
  // Images allowed by the field already render read-only; to let writers upload
  // and insert them, pass `{ ..., media: { upload } }` (e.g. a `makeMediaClient`
  // `upload`) and add `<RichTextImageButton upload={…} />` to the toolbar's
  // `extra` slot — see this item's demo wiring.
  const { plugins, components } = useMemo(
    () => derivePlugins(elements, marks, { slash: true }),
    [elements, marks],
  );
  const toolbar = useMemo(() => deriveToolbar(elements, marks), [elements, marks]);
  // `value` only seeds the editor's initial state — Plate owns it after mount and
  // doesn't re-read this, so live prop changes never fight the cursor. The form
  // remounts the widget per document, so the value at mount is the right one.
  const initial = useMemo(() => fromWire(asValue(value)), [value]);

  return (
    <RichTextEditor
      value={initial}
      onChange={(next) => onChange(toWire(next))}
      plugins={plugins}
      components={components}
      placeholder="Write something, or press / for commands…"
      toolbar={
        <>
          <RichTextToolbar model={toolbar} />
          <RichTextFloatingToolbar model={toolbar} />
        </>
      }
      readOnly={disabled}
      id={id}
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    />
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
    return (
      <div className="space-y-2">
        {richFlavor !== null ? (
          <ModeToggle label="Rich editor" onClick={() => setRaw(false)} disabled={disabled} />
        ) : null}
        <Textarea
          id={id}
          className="min-h-40 font-mono"
          value={text}
          placeholder={meta.description}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-labelledby={labelId}
          {...aria(id, error)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ModeToggle label="Edit Markdown" onClick={() => setRaw(true)} disabled={disabled} />
      <MarkdownRichEditor
        text={text}
        flavor={richFlavor}
        onChange={onChange}
        id={id}
        labelId={labelId}
        error={error}
        disabled={disabled}
      />
    </div>
  );
}

interface MarkdownRichEditorProps {
  readonly text: string;
  readonly flavor: MarkdownFlavor;
  readonly onChange: (value: unknown) => void;
  readonly id: string;
  readonly labelId?: string;
  readonly error?: string;
  readonly disabled?: boolean;
}

function MarkdownRichEditor({
  text,
  flavor,
  onChange,
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
    <RichTextEditor
      value={initial}
      // Serialize straight back to a markdown string so the form value stays the
      // stored shape and re-validates against the field's own schema.
      onChange={(next) => onChange(toMarkdown(next, { flavor }))}
      plugins={plugins}
      components={components}
      toolbar={
        <>
          <RichTextToolbar model={toolbar} />
          <RichTextFloatingToolbar model={toolbar} />
        </>
      }
      readOnly={disabled}
      id={id}
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    />
  );
}

function ModeToggle({
  label,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}): ReactNode {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}
