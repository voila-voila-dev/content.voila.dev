// The `fields.richText({...})` constructor. Walks the selected
// elements/marks at runtime, assembles the recursive node schema, and
// returns a Schema whose top level is `Array<ElementUnion>`.

import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "../_base";
import type { RichTextElementDef, RichTextMarkDef, RichTextNode, RichTextValue } from "./_core";
import { defaultElements, defaultMarks } from "./defaults";

export interface RichTextOpts extends BaseFieldOpts<RichTextValue> {
  /**
   * Allowed element kinds. Defaults to {@link defaultElements}. Pass a
   * subset to restrict the field, or splat the defaults and append custom
   * elements built with `defineElement`.
   */
  readonly elements?: ReadonlyArray<RichTextElementDef>;
  /** Allowed mark kinds. Defaults to {@link defaultMarks}. */
  readonly marks?: ReadonlyArray<RichTextMarkDef>;
  /**
   * Opaque editor configuration handed through to the Head's editor —
   * @voila/content can't depend on a specific editor library so plugins
   * are typed as `unknown[]` here and narrowed at the call site.
   */
  readonly plugins?: ReadonlyArray<unknown>;
  /** Node-component overrides keyed by element type. */
  readonly components?: Readonly<Record<string, unknown>>;
  /** Toolbar slot ids the admin renders. */
  readonly toolbar?: ReadonlyArray<string>;
}

const buildLeafSchema = (marks: ReadonlyArray<RichTextMarkDef>): Schema.Schema.Any => {
  // `Schema.optional` returns a `PropertySignature`, not a `Schema` — the
  // mixed bag is fine inside `Schema.Struct({...})` but doesn't fit one
  // narrow TS type, so the field map is typed `any` for the assembly step.
  // biome-ignore lint/suspicious/noExplicitAny: Schema.Struct accepts both Schema and PropertySignature values.
  const fields: Record<string, any> = { text: Schema.String };
  for (const mark of marks) fields[mark.key] = Schema.optional(mark.schema);
  return Schema.Struct(fields);
};

const unionOf = (schemas: ReadonlyArray<Schema.Schema.Any>): Schema.Schema.Any => {
  if (schemas.length === 0) throw new Error("rich-text: at least one element is required");
  if (schemas.length === 1) return schemas[0] as Schema.Schema.Any;
  const [a, b, ...rest] = schemas;
  // biome-ignore lint/suspicious/noExplicitAny: Schema.Union's variadic signature is fine with widened schemas.
  return Schema.Union(a as any, b as any, ...(rest as Array<any>));
};

const buildRichTextSchema = (
  elements: ReadonlyArray<RichTextElementDef>,
  marks: ReadonlyArray<RichTextMarkDef>,
): Schema.Schema.Any => {
  const leaf = buildLeafSchema(marks);
  // Suspend so every element's `build(node)` resolves to the same recursive
  // node schema. The placeholder is assigned before any suspended thunk runs.
  // biome-ignore lint/suspicious/noExplicitAny: dynamic schema graph — `node` needs to close over its own suspension.
  let node: Schema.Schema<RichTextNode> = undefined as any;
  node = Schema.suspend(() =>
    unionOf([leaf, ...elements.map((e) => e.build(node))]),
  ) as unknown as Schema.Schema<RichTextNode>;
  // Top level is strictly an array of elements (no bare leaves at the root).
  return Schema.Array(unionOf(elements.map((e) => e.build(node))));
};

export const richText = <const O extends RichTextOpts = RichTextOpts>(
  opts?: O,
): WithLocalized<RichTextValue, O> => {
  const o = opts ?? ({} as O);
  const elements: ReadonlyArray<RichTextElementDef> =
    o.elements ?? (defaultElements as unknown as ReadonlyArray<RichTextElementDef>);
  const marks: ReadonlyArray<RichTextMarkDef> =
    o.marks ?? (defaultMarks as unknown as ReadonlyArray<RichTextMarkDef>);
  return applyCommon(buildRichTextSchema(elements, marks), o, {
    kind: "richText",
    widget: "richText",
    elements: elements.map((e) => e.type),
    marks: marks.map((m) => m.key),
    plugins: o.plugins,
    components: o.components,
    toolbar: o.toolbar,
  }) as WithLocalized<RichTextValue, O>;
};
