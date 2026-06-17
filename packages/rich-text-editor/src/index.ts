// Re-exported so consumers can type document values without depending on
// `platejs` directly.
export type { Descendant, NodeComponents, TElement, TText, Value } from "platejs";
export type { RichTextEditorProps } from "./editor.tsx";
export { RichTextEditor } from "./editor.tsx";
export type { RichTextFloatingToolbarProps } from "./floating-toolbar.tsx";
export { RichTextFloatingToolbar } from "./floating-toolbar.tsx";
export type { RichTextImageButtonProps } from "./media.tsx";
export { RichTextImageButton } from "./media.tsx";
export { basicPlugins } from "./plugins/basic.ts";
export { toHtml, toJson, toPlainText } from "./serialize.ts";
export type { RichTextToolbarProps } from "./toolbar.tsx";
export { RichTextToolbar } from "./toolbar.tsx";
