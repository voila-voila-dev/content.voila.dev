import { PlateElement, type PlateElementProps } from "platejs/react";
import { ORIGINAL_NODE_KEY } from "../content/wire.ts";

/**
 * Read-only render for a wire element the editor cannot edit (a `table`, media,
 * a future node kind…). The original node is preserved verbatim under
 * {@link ORIGINAL_NODE_KEY} and restored on save; this just labels the block so
 * the writer knows it is intentionally non-editable rather than lost.
 */
export function UnsupportedElement(props: PlateElementProps) {
  const original = (props.element as Record<string, unknown>)[ORIGINAL_NODE_KEY] as
    | { type?: unknown }
    | undefined;
  const type = typeof original?.type === "string" ? original.type : "unknown";
  return (
    <PlateElement {...props} className="voila-rich-text-unsupported">
      <div aria-hidden className="voila-rich-text-unsupported-label" contentEditable={false}>
        {type} — not editable here
      </div>
      {props.children}
    </PlateElement>
  );
}
