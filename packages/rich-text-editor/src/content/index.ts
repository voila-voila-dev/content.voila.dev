// `@voila/rich-text-editor/content` — the seam between the Plate editor and the
// `@voila/content` engine's `richText` field. The wire adapter and capability
// map live here (one canonical, tested implementation) so the vended widget
// stays thin glue. Type-only imports from `@voila/content` keep the editor
// package framework-agnostic — `@voila/content` is an optional peer dependency.

export type { MediaOptions, UploadedMedia } from "../media.tsx";
export { insertImageFiles } from "../media.tsx";
export type { MentionItem, MentionOptions } from "../mention.tsx";
export { deriveSlashItems, type SlashItem } from "../slash.tsx";
export type {
  DerivedEditorConfig,
  DerivePluginsOptions,
  ElementCapability,
  InputRuleFactory,
  MarkCapability,
  ToolbarControl,
  ToolbarControlKind,
  ToolbarModel,
} from "./capabilities.ts";
export {
  deriveMarkdownPlugins,
  deriveMarkdownToolbar,
  derivePlugins,
  deriveToolbar,
  supportedElements,
  supportedMarks,
} from "./capabilities.ts";
export type { ToWireOptions } from "./wire.ts";
export {
  fromWire,
  ORIGINAL_NODE_KEY,
  PLATE_TO_WIRE,
  SUPPORTED_MARKS,
  toWire,
  UNSUPPORTED_TYPE,
  WIRE_TO_PLATE,
} from "./wire.ts";
