import type { NodeComponents, Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { basicPlugins } from "./plugins/basic.ts";

export interface RichTextEditorProps {
  /** Initial document. A Slate value (array of nodes). */
  value?: Value;
  /** Called with the full document on every change. */
  onChange?: (value: Value) => void;
  /** Plate plugins. Defaults to {@link basicPlugins}. */
  plugins?: typeof basicPlugins;
  /**
   * Map of node key → render component. The editor is presentation-agnostic;
   * pass `nodeComponents` from `@voila/rich-text-nodes` for the default set, or
   * your own components to fully restyle / extend rendering.
   */
  components?: NodeComponents;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

/**
 * A headless rich-text editor built on Plate (Slate). It wires plugins and
 * change handling but renders nodes with whatever `components` you give it —
 * keeping behavior (this package) separate from presentation
 * (`@voila/rich-text-nodes`). Style the content area via `className` (defaults
 * to `voila-rich-text`, see `./styles.css`).
 */
export function RichTextEditor({
  value,
  onChange,
  plugins,
  components,
  placeholder = "Write something…",
  readOnly = false,
  className = "voila-rich-text",
}: RichTextEditorProps) {
  const editor = usePlateEditor({
    plugins: plugins ?? basicPlugins,
    components,
    value,
  });

  return (
    <Plate editor={editor} onChange={(options) => onChange?.(options.value)}>
      <PlateContent className={className} placeholder={placeholder} readOnly={readOnly} />
    </Plate>
  );
}
