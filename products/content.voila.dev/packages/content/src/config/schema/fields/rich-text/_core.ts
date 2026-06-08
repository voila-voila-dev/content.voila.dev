// Core rich-text primitives shared across every element/mark file: the node
// interfaces, the `*Def` shapes that elements/marks export, the
// `defineElement` / `defineMark` helpers consumers use to add their own kinds,
// and a couple of small validators reused by built-ins. Re-exports the handful
// of `std` builders the element/mark files need so each stays a one-liner.

import { arrayOf, bool, literal, type Shape, str, struct, type Validator } from "../../std";

/** A text leaf. `text` is the rendered string; every other key is a mark. */
export interface RichTextLeaf {
  readonly text: string;
  readonly [mark: string]: unknown;
}

/**
 * A block or inline element. `type` discriminates the kind; concrete element
 * interfaces extend this with their own attributes (e.g. `url` on
 * `LinkElement`). No open index signature — narrow by `type` first, then
 * access typed attrs.
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
 * validator so the element's `children` can be wired to whichever set of
 * elements/marks the surrounding field actually allows.
 */
export interface RichTextElementDef<
  Type extends string = string,
  Value extends RichTextElement = RichTextElement,
> {
  readonly type: Type;
  readonly build: (node: Validator<RichTextNode>) => Validator<Value>;
}

/** A mark kind. The validator's output is the on-leaf value (`true`, a string, …). */
export interface RichTextMarkDef<Key extends string = string, Value = boolean> {
  readonly key: Key;
  readonly schema: Validator<Value>;
}

export function defineElement<const Type extends string, Value extends RichTextElement>(def: {
  readonly type: Type;
  readonly build: (node: Validator<RichTextNode>) => Validator<Value>;
}): RichTextElementDef<Type, Value> {
  return def;
}

/**
 * Sugar around `defineElement` for the common case: every element has the same
 * `{id, type, children}` skeleton, then a handful of element-specific attrs.
 * `element(type, attrs)` wires the skeleton automatically so each element file
 * is just its attrs plus a derived type alias.
 *
 * ```ts
 * export const video = element("video", { url: str(), caption: optional(str()) });
 * export type VideoElement = Infer<ReturnType<typeof video.build>>;
 * ```
 */
export function element<const Type extends string, Attrs extends Shape>(type: Type, attrs: Attrs) {
  function build(node: Validator<RichTextNode>) {
    return struct({
      id: str(),
      type: literal(type),
      children: arrayOf(node),
      ...attrs,
    });
  }
  return { type, build };
}

// Two overloads keep the implementation honest: with no schema the mark is
// boolean (the toggle-on-the-leaf case); with a schema, `Value` is derived
// from it.
export function defineMark<const Key extends string>(def: {
  readonly key: Key;
}): RichTextMarkDef<Key, boolean>;
export function defineMark<const Key extends string, Value>(def: {
  readonly key: Key;
  readonly schema: Validator<Value>;
}): RichTextMarkDef<Key, Value>;
export function defineMark(def: { readonly key: string; readonly schema?: Validator<unknown> }): {
  readonly key: string;
  readonly schema: Validator<unknown>;
} {
  return { key: def.key, schema: def.schema ?? bool() };
}

/** `arrayOf(node)` — every element wires children the same way. */
export function child(node: Validator<RichTextNode>): Validator<ReadonlyArray<RichTextNode>> {
  return arrayOf(node);
}

// `alignSchema` / `Align` live here because seven elements need them
// (paragraph + all six headings).
export const alignSchema = literal("left", "center", "right", "justify");
export type Align = "left" | "center" | "right" | "justify";

// Re-export the std builders element/mark files compose their attrs from, so
// they only ever import from "../_core".
export {
  arrayOf,
  bool,
  type Infer,
  integer,
  literal,
  max,
  min,
  num,
  optional,
  refine,
  str,
  union,
  type Validator,
} from "../../std";
