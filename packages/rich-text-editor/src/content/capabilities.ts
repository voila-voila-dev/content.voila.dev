// The capability map: which wire element/mark kinds the editor can actually
// edit, and the Plate plugin + node component that powers each. `derivePlugins`
// turns a field's allowed `elements`/`marks` (from `RichTextMeta`) into the
// exact plugin set and component map to hand `<RichTextEditor />` — so a
// restricted `richText({ elements: [paragraph, link] })` field gets a
// restricted editor for free, and unknown kinds are left to the wire layer's
// opaque preservation (see `./wire`).

import {
  BlockquoteRules,
  BoldRules,
  CodeRules,
  HeadingRules,
  ItalicRules,
  StrikethroughRules,
  UnderlineRules,
} from "@platejs/basic-nodes";
import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { LinkPlugin } from "@platejs/link/react";
import { BulletedListRules, OrderedListRules } from "@platejs/list-classic";
import {
  BulletedListPlugin,
  ListItemContentPlugin,
  ListItemPlugin,
  NumberedListPlugin,
} from "@platejs/list-classic/react";
import { type NodeComponent, type NodeComponents, NodeIdPlugin } from "platejs";
import { type AnyPlatePlugin, createPlatePlugin, ParagraphPlugin } from "platejs/react";
import type { MarkdownFlavor } from "../markdown.ts";
import {
  BlockquoteElement,
  BoldLeaf,
  BulletedListElement,
  CodeLeaf,
  H1Element,
  H2Element,
  H3Element,
  ItalicLeaf,
  LinkElement,
  ListItemContentElement,
  ListItemElement,
  NumberedListElement,
  StrikethroughLeaf,
  UnderlineLeaf,
} from "../nodes/index.ts";
import { UnsupportedElement } from "../nodes/unsupported-element.tsx";
import { UNSUPPORTED_TYPE } from "./wire.ts";

/**
 * Factory for the markdown autoformat input rule a capability owns — e.g.
 * `HeadingRules.markdown` turns `# ` into a heading. Registered on the owning
 * plugin (the rule reads the plugin key to pick `#`/`##`/`###`), so a kind only
 * gets its shortcut when its plugin is in the editor. `derivePlugins`'
 * `autoformat` option gates the whole feature.
 */
export type InputRuleFactory = () => ReturnType<typeof HeadingRules.markdown>;

/** How a single wire element kind maps onto the editor. */
export interface ElementCapability {
  /** Plate plugin that enables the kind (Plate core already provides some). */
  readonly plugin: AnyPlatePlugin;
  /** Plate node key the plugin renders under (the component-map key). */
  readonly plateKey: string;
  /** Default node component, or `null` to let Plate core render it. */
  readonly component: NodeComponent | null;
  /** Markdown shortcut rule attached to {@link plugin}, if the kind has one. */
  readonly rule?: InputRuleFactory;
}

/** How a single wire mark kind maps onto the editor. */
export interface MarkCapability {
  readonly plugin: AnyPlatePlugin;
  readonly plateKey: string;
  readonly component: NodeComponent;
  /** Markdown shortcut rule attached to {@link plugin}, if the mark has one. */
  readonly rule?: InputRuleFactory;
}

/**
 * Wire element type → editor capability. The keys here are the ground truth for
 * "what the editor can edit"; anything outside this set is preserved opaquely by
 * the wire adapter. `list-item` implies `lic` (Plate's list-item-content
 * wrapper), which `derivePlugins` adds whenever any list kind is enabled.
 */
export const supportedElements: Readonly<Record<string, ElementCapability>> = {
  paragraph: { plugin: ParagraphPlugin, plateKey: ParagraphPlugin.key, component: null },
  "heading-1": {
    plugin: H1Plugin,
    plateKey: H1Plugin.key,
    component: H1Element,
    rule: HeadingRules.markdown,
  },
  "heading-2": {
    plugin: H2Plugin,
    plateKey: H2Plugin.key,
    component: H2Element,
    rule: HeadingRules.markdown,
  },
  "heading-3": {
    plugin: H3Plugin,
    plateKey: H3Plugin.key,
    component: H3Element,
    rule: HeadingRules.markdown,
  },
  blockquote: {
    plugin: BlockquotePlugin,
    plateKey: BlockquotePlugin.key,
    component: BlockquoteElement,
    rule: BlockquoteRules.markdown,
  },
  "bullet-list": {
    plugin: BulletedListPlugin,
    plateKey: BulletedListPlugin.key,
    component: BulletedListElement,
    rule: BulletedListRules.markdown,
  },
  "ordered-list": {
    plugin: NumberedListPlugin,
    plateKey: NumberedListPlugin.key,
    component: NumberedListElement,
    rule: OrderedListRules.markdown,
  },
  "list-item": { plugin: ListItemPlugin, plateKey: ListItemPlugin.key, component: ListItemElement },
  link: { plugin: LinkPlugin, plateKey: LinkPlugin.key, component: LinkElement },
};

/** Wire mark key → editor capability. Unsupported marks ride along verbatim. */
export const supportedMarks: Readonly<Record<string, MarkCapability>> = {
  bold: {
    plugin: BoldPlugin,
    plateKey: BoldPlugin.key,
    component: BoldLeaf,
    rule: BoldRules.markdown,
  },
  italic: {
    plugin: ItalicPlugin,
    plateKey: ItalicPlugin.key,
    component: ItalicLeaf,
    rule: ItalicRules.markdown,
  },
  underline: {
    plugin: UnderlinePlugin,
    plateKey: UnderlinePlugin.key,
    component: UnderlineLeaf,
    rule: UnderlineRules.markdown,
  },
  strikethrough: {
    plugin: StrikethroughPlugin,
    plateKey: StrikethroughPlugin.key,
    component: StrikethroughLeaf,
    rule: StrikethroughRules.markdown,
  },
  code: {
    plugin: CodePlugin,
    plateKey: CodePlugin.key,
    component: CodeLeaf,
    rule: CodeRules.markdown,
  },
};

/** Renders preserved unknown wire elements as read-only void blocks. */
const UnsupportedPlugin = createPlatePlugin({
  key: UNSUPPORTED_TYPE,
  node: { isElement: true, isVoid: true, component: UnsupportedElement },
});

function isListType(wireType: string): boolean {
  return wireType === "bullet-list" || wireType === "ordered-list" || wireType === "list-item";
}

export interface DerivedEditorConfig {
  readonly plugins: AnyPlatePlugin[];
  readonly components: NodeComponents;
}

export interface DerivePluginsOptions {
  /**
   * Register markdown autoformat shortcuts (`# `, `> `, `- `, `**bold**`, …) on
   * the derived plugins. Only kinds whose plugin is enabled get a shortcut, so
   * a restricted field offers exactly the shortcuts it can persist. Defaults to
   * `true`.
   */
  readonly autoformat?: boolean;
}

/**
 * Returns the plugin to register for a capability — the bare plugin, or a copy
 * configured with its markdown shortcut when `autoformat` is on and the
 * capability owns a rule. The rule is minted per call so each heading plugin
 * gets its own instance (the rule reads the plugin key for `#`/`##`/`###`).
 */
function withAutoformat(
  cap: ElementCapability | MarkCapability,
  autoformat: boolean,
): AnyPlatePlugin {
  if (!autoformat || !cap.rule) return cap.plugin;
  return (cap.plugin as { configure: (c: { inputRules: unknown[] }) => AnyPlatePlugin }).configure({
    inputRules: [cap.rule()],
  });
}

/**
 * Derives the editor's plugin set and component map from a field's allowed
 * `elements`/`marks` (typically `meta.elements` / `meta.marks`), intersected
 * with what the editor supports. Always includes node-id tracking (so ids ride
 * through edits) and the unsupported-block plugin (so preserved nodes render);
 * by default also wires markdown autoformat shortcuts (see {@link DerivePluginsOptions}).
 */
export function derivePlugins(
  elements: ReadonlyArray<string>,
  marks: ReadonlyArray<string>,
  options: DerivePluginsOptions = {},
): DerivedEditorConfig {
  const autoformat = options.autoformat ?? true;
  // NodeIdPlugin is a Slate-level plugin; it composes into a Plate editor fine
  // but its static type doesn't structurally match the React plugin shape.
  const plugins: AnyPlatePlugin[] = [NodeIdPlugin as unknown as AnyPlatePlugin, UnsupportedPlugin];
  const components: Record<string, NodeComponent> = { [UNSUPPORTED_TYPE]: UnsupportedElement };

  let hasList = false;
  for (const wireType of elements) {
    const cap = supportedElements[wireType];
    if (!cap) continue;
    plugins.push(withAutoformat(cap, autoformat));
    if (cap.component) components[cap.plateKey] = cap.component;
    if (isListType(wireType)) hasList = true;
  }
  if (hasList) {
    plugins.push(ListItemContentPlugin);
    components[ListItemContentPlugin.key] = ListItemContentElement;
  }

  for (const markKey of marks) {
    const cap = supportedMarks[markKey];
    if (!cap) continue;
    plugins.push(withAutoformat(cap, autoformat));
    components[cap.plateKey] = cap.component;
  }

  return { plugins, components };
}

/**
 * The wire element kinds a markdown document can represent (the E1 node set).
 * Unlike `richText`, a `markdown` field carries no `elements`/`marks` meta — the
 * editor's capability is fixed by what markdown can spell, not by the field.
 */
const MARKDOWN_ELEMENTS: ReadonlyArray<string> = [
  "paragraph",
  "heading-1",
  "heading-2",
  "heading-3",
  "blockquote",
  "bullet-list",
  "ordered-list",
  "list-item",
  "link",
];

/** Marks every flavor can spell. `strikethrough` is GFM-only; `underline` never. */
const MARKDOWN_MARKS: ReadonlyArray<string> = ["bold", "italic", "code"];

/**
 * Derives the editor config for a `markdown` field. The plugin set is fixed to
 * the markdown-representable node kinds (so the editor never offers a control
 * whose result couldn't survive serialization), widened by `strikethrough` only
 * under GFM.
 */
function markdownMarks(flavor: MarkdownFlavor): ReadonlyArray<string> {
  return flavor === "gfm" ? [...MARKDOWN_MARKS, "strikethrough"] : MARKDOWN_MARKS;
}

export function deriveMarkdownPlugins(flavor: MarkdownFlavor): DerivedEditorConfig {
  return derivePlugins(MARKDOWN_ELEMENTS, markdownMarks(flavor));
}

/** How a toolbar control drives the editor: a block turn-into, a mark, a list. */
export type ToolbarControlKind = "block" | "mark" | "list";

/** A single toolbar button, resolved from the field's allowed kinds. */
export interface ToolbarControl {
  readonly control: ToolbarControlKind;
  /** Wire kind (e.g. `heading-1`, `bold`, `bullet-list`). */
  readonly wireType: string;
  /** Plate node/mark key the control toggles (e.g. `h1`, `bold`, `ul`). */
  readonly plateKey: string;
  /** Accessible label, e.g. "Heading 1". */
  readonly label: string;
}

/** The toolbar's controls, grouped for rendering with separators. */
export interface ToolbarModel {
  readonly blocks: ReadonlyArray<ToolbarControl>;
  readonly marks: ReadonlyArray<ToolbarControl>;
  readonly lists: ReadonlyArray<ToolbarControl>;
}

/** Display order + labels for block turn-into controls. */
const BLOCK_CONTROLS: ReadonlyArray<readonly [wireType: string, label: string]> = [
  ["paragraph", "Paragraph"],
  ["heading-1", "Heading 1"],
  ["heading-2", "Heading 2"],
  ["heading-3", "Heading 3"],
  ["blockquote", "Quote"],
];

/** Display order + labels for mark controls. */
const MARK_CONTROLS: ReadonlyArray<readonly [wireType: string, label: string]> = [
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["underline", "Underline"],
  ["strikethrough", "Strikethrough"],
  ["code", "Code"],
];

/** Display order + labels for list controls. */
const LIST_CONTROLS: ReadonlyArray<readonly [wireType: string, label: string]> = [
  ["bullet-list", "Bulleted list"],
  ["ordered-list", "Numbered list"],
];

/**
 * Resolves a field's allowed `elements`/`marks` into the fixed-toolbar model,
 * intersected with what the editor supports — the same capability gate
 * `derivePlugins` applies, so the toolbar never shows a control whose result the
 * field couldn't persist. Empty groups are returned for the renderer to skip.
 */
export function deriveToolbar(
  elements: ReadonlyArray<string>,
  marks: ReadonlyArray<string>,
): ToolbarModel {
  const elementSet = new Set(elements);
  const markSet = new Set(marks);

  const blocks: ToolbarControl[] = [];
  for (const [wireType, label] of BLOCK_CONTROLS) {
    const cap = supportedElements[wireType];
    if (cap && elementSet.has(wireType)) {
      blocks.push({ control: "block", wireType, plateKey: cap.plateKey, label });
    }
  }

  const markControls: ToolbarControl[] = [];
  for (const [wireType, label] of MARK_CONTROLS) {
    const cap = supportedMarks[wireType];
    if (cap && markSet.has(wireType)) {
      markControls.push({ control: "mark", wireType, plateKey: cap.plateKey, label });
    }
  }

  const lists: ToolbarControl[] = [];
  for (const [wireType, label] of LIST_CONTROLS) {
    const cap = supportedElements[wireType];
    if (cap && elementSet.has(wireType)) {
      lists.push({ control: "list", wireType, plateKey: cap.plateKey, label });
    }
  }

  return { blocks, marks: markControls, lists };
}

/** The fixed-toolbar model for a `markdown` field, mirroring {@link deriveMarkdownPlugins}. */
export function deriveMarkdownToolbar(flavor: MarkdownFlavor): ToolbarModel {
  return deriveToolbar(MARKDOWN_ELEMENTS, markdownMarks(flavor));
}
