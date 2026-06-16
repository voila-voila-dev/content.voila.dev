import type { NodeComponents, Value } from "platejs";
import { type AnyPlatePlugin, Plate, PlateContent, usePlateEditor } from "platejs/react";
import type { ReactNode } from "react";
import { basicPlugins } from "./plugins/basic.ts";

export interface RichTextEditorProps {
  /** Initial document. A Slate value (array of nodes). */
  value?: Value;
  /** Called with the full document on every change. */
  onChange?: (value: Value) => void;
  /** Plate plugins. Defaults to {@link basicPlugins}. */
  plugins?: AnyPlatePlugin[];
  /**
   * Map of node key → render component. The editor is presentation-agnostic;
   * pass `nodeComponents` from `@voila/rich-text-editor/nodes` for the default
   * set, or your own components to fully restyle / extend rendering.
   */
  components?: NodeComponents;
  /**
   * Optional chrome rendered above the editable surface, inside the Plate
   * provider — pass `<RichTextToolbar>` here so it can drive the editor.
   */
  toolbar?: ReactNode;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** DOM id of the editable surface, so a `<label htmlFor>` can target it. */
  id?: string;
  /** Forwarded to the editable so a host form can name and validate it the same
   *  way it does a native control (the `@voila/content-ui` widget contract). */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * A headless rich-text editor built on Plate (Slate). It wires plugins and
 * change handling but renders nodes with whatever `components` you give it —
 * keeping behavior (this entry) separate from presentation
 * (`@voila/rich-text-editor/nodes`). Style the content area via `className`
 * (defaults to `voila-rich-text`, see `./styles.css`).
 */
export function RichTextEditor({
  value,
  onChange,
  plugins,
  components,
  toolbar,
  placeholder = "Write something…",
  readOnly = false,
  className = "voila-rich-text",
  id,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
}: RichTextEditorProps) {
  const editor = usePlateEditor({
    plugins: plugins ?? basicPlugins,
    components,
    value,
  });

  return (
    <Plate editor={editor} onChange={(options) => onChange?.(options.value)}>
      {toolbar}
      <PlateContent
        id={id}
        className={className}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
      />
    </Plate>
  );
}
