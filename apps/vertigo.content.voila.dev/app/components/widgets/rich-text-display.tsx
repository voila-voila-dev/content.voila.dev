// RichTextDisplay — a read-only, formatted render of a `richText` value for the
// admin detail view and table cells. It converts the stored wire document to
// the editor's node shape (`fromWire`) and serializes it to a self-contained,
// fully-escaped HTML string (`toHtml`) — no live editor per cell, so it stays
// cheap in lists. The `voila-rich-text` class shares the editor's content styles.

import type { rt } from "@voila/content";
import {
  type DisplayWidgetProps,
  isCompact,
  Preview,
  richTextToPlain,
  truncateText,
} from "@voila/content-ui";
import { fromWire } from "@voila/rich-text-editor/content";
import { toHtml } from "@voila/rich-text-editor/serialize";
import "@voila/rich-text-editor/styles.css";
import type { ReactNode } from "react";

export function RichTextDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  // A table cell / board card wants a one-line plain-text preview, not the
  // formatted document (which would make rows 150px tall).
  if (isCompact(context)) {
    const text = richTextToPlain(value);
    return text ? (
      <Preview text={truncateText(text, 160)} slot="rich-text-display" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  const html = toHtml(fromWire(value as rt.RichTextValue));
  return (
    <div
      data-slot="rich-text-display"
      // `voila-rich-text` shares the editor's content styles; the read-only
      // render drops the editor's padding / min-height so the value sits flush
      // with the other detail rows.
      className="voila-rich-text voila-rich-text-readonly"
      // Safe to inject: the content is the app's own stored, schema-validated
      // richText, and `toHtml` escapes every text node and attribute.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-escaped, schema-validated content
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
