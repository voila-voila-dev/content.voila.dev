// RichTextDisplay — a read-only, formatted render of a `richText` value for the
// admin detail view and table cells. It converts the stored wire document to
// the editor's node shape (`fromWire`) and serializes it to a self-contained,
// fully-escaped HTML string (`toHtml`) — no live editor per cell, so it stays
// cheap in lists. (Out of the box, before `voila add rich-text-editor`,
// `@voila/content-ui` flattens richText to plain text; this upgrades it to real
// formatting.) The `voila-rich-text` class shares the editor's content styles.

import type { rt } from "@voila/content";
import type { DisplayWidgetProps } from "@voila/content-ui";
import { fromWire } from "@voila/rich-text-editor/content";
import { toHtml } from "@voila/rich-text-editor/serialize";
import "@voila/rich-text-editor/styles.css";
import type { ReactNode } from "react";

export function RichTextDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const html = toHtml(fromWire(value as rt.RichTextValue));
  return (
    <div
      className="voila-rich-text"
      // Safe to inject: the content is the app's own stored, schema-validated
      // richText, and `toHtml` escapes every text node and attribute.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
