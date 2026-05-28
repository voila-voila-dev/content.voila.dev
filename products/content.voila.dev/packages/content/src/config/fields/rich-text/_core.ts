// Core rich-text primitives shared across every element/mark file:
// the node interfaces, the `*Def` shapes that elements/marks export,
// the `defineElement` / `defineMark` helpers consumers use to add their
// own kinds, and a couple of small Schema constants reused by built-ins.

import { Schema } from "effect";

/** A text leaf. `text` is the rendered string; every other key is a mark. */
export interface RichTextLeaf {
  readonly text: string;
  readonly [mark: string]: unknown;
}

/**
 * A block or inline element. `type` discriminates the kind; concrete
 * element interfaces extend this with their own attributes (e.g. `url` on
 * `LinkElement`, `language` on `CodeBlockElement`). No open index signature
 * — narrow by `type` first, then access typed attrs.
 */
export interface RichTextElement {
  readonly id: string;
  readonly type: string;
  readonly children: ReadonlyArray<RichTextNode>;
}

export type RichTextNode = RichTextElement | RichTextLeaf;

/** A document is a top-level array of elements (never bare leaves). */
export type RichTextValue = ReadonlyArray<RichTextElement>;

/**
 * An element kind. `build` receives the recursively-defined `RichTextNode`
 * schema so the element's `children` field can be wired to whichever set
 * of elements/marks the surrounding field actually allows.
 */
export interface RichTextElementDef<
  Type extends string = string,
  Value extends RichTextElement = RichTextElement,
> {
  readonly type: Type;
  readonly build: (node: Schema.Schema<RichTextNode>) => Schema.Schema<Value>;
}

/** A mark kind. The schema's `Type` is the on-leaf value (`true`, a string, …). */
export interface RichTextMarkDef<Key extends string = string, Value = boolean> {
  readonly key: Key;
  readonly schema: Schema.Schema<Value>;
}

export const defineElement = <const Type extends string, Value extends RichTextElement>(def: {
  readonly type: Type;
  readonly build: (node: Schema.Schema<RichTextNode>) => Schema.Schema<Value>;
}): RichTextElementDef<Type, Value> => def;

/**
 * Sugar around `defineElement` for the common case: every element has the
 * same `{id, type, children}` skeleton, then a handful of element-specific
 * attrs. `element(type, attrs)` wires the skeleton automatically so each
 * element file is just its attrs plus a derived type alias.
 *
 * ```ts
 * export const video = element("video", {
 *   url: Schema.String,
 *   caption: Schema.optional(Schema.String),
 * });
 * export type VideoElement = Schema.Schema.Type<ReturnType<typeof video.build>>;
 * ```
 */
export const element = <const Type extends string, Attrs extends Schema.Struct.Fields>(
  type: Type,
  attrs: Attrs,
) => {
  const build = (node: Schema.Schema<RichTextNode>) =>
    Schema.Struct({
      id: Schema.String,
      type: Schema.Literal(type),
      children: Schema.Array(node),
      ...attrs,
    });
  return { type, build };
};

// Two overloads keep the implementation honest: with no schema, the mark is
// boolean (the toggle-on-the-leaf case); with a schema, `Value` is derived
// from it. A single signature can't express that without an unsound cast.
export function defineMark<const Key extends string>(def: {
  readonly key: Key;
}): RichTextMarkDef<Key, boolean>;
export function defineMark<const Key extends string, Value>(def: {
  readonly key: Key;
  readonly schema: Schema.Schema<Value>;
}): RichTextMarkDef<Key, Value>;
export function defineMark(def: { readonly key: string; readonly schema?: Schema.Schema.Any }): {
  readonly key: string;
  readonly schema: Schema.Schema.Any;
} {
  return { key: def.key, schema: def.schema ?? Schema.Boolean };
}

/** `children: Schema.Array(node)` — every element wires children the same way. */
export const child = (node: Schema.Schema<RichTextNode>) => Schema.Array(node);

// `alignSchema` / `Align` stay here because seven elements need them
// (paragraph + all six headings). List-style lives in paragraph.ts — sole
// consumer.
export const alignSchema = Schema.Union(
  Schema.Literal("left"),
  Schema.Literal("center"),
  Schema.Literal("right"),
  Schema.Literal("justify"),
);

export type Align = "left" | "center" | "right" | "justify";
