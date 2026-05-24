// Re-exported so consumers can type document values without depending on
// `platejs` directly.
export type { Descendant, NodeComponents, TElement, TText, Value } from "platejs";
export type { RichTextEditorProps } from "./editor.tsx";
export { RichTextEditor } from "./editor.tsx";
export { basicPlugins } from "./plugins/basic.ts";
export { toHtml, toJson, toPlainText } from "./serialize.ts";
