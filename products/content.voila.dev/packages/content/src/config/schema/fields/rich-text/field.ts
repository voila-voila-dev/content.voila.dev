// The `fields.richText({...})` constructor. Walks the selected elements/marks
// at runtime, assembles the recursive node validator, and returns a Field whose
// top level is `Array<ElementUnion>`.

import { arrayOf, lazy, optional, str, struct, union, type Validator } from "../../std";
import type { FieldMeta } from "../_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "../_base";
import type {
  RichTextElementDef,
  RichTextLeaf,
  RichTextMarkDef,
  RichTextNode,
  RichTextValue,
} from "./_core";
import { defaultElements, defaultMarks } from "./defaults";

export type RichTextMeta = FieldMeta<{
  readonly elements: ReadonlyArray<string>;
  readonly marks: ReadonlyArray<string>;
  readonly plugins?: ReadonlyArray<unknown>;
  readonly components?: Readonly<Record<string, unknown>>;
  readonly toolbar?: ReadonlyArray<string>;
}>;

export interface RichTextOpts extends BaseFieldOpts<RichTextValue> {
  /**
   * Allowed element kinds. Defaults to {@link defaultElements}. Pass a subset
   * to restrict the field, or splat the defaults and append custom elements
   * built with `defineElement`.
   */
  readonly elements?: ReadonlyArray<RichTextElementDef>;
  /** Allowed mark kinds. Defaults to {@link defaultMarks}. */
  readonly marks?: ReadonlyArray<RichTextMarkDef>;
  /**
   * Opaque editor configuration handed through to the Head's editor —
   * @voila/content can't depend on a specific editor library so plugins are
   * typed as `unknown[]` here and narrowed at the call site.
   */
  readonly plugins?: ReadonlyArray<unknown>;
  /** Node-component overrides keyed by element type. */
  readonly components?: Readonly<Record<string, unknown>>;
  /** Toolbar slot ids the admin renders. */
  readonly toolbar?: ReadonlyArray<string>;
}

function buildLeafSchema(marks: ReadonlyArray<RichTextMarkDef>): Validator<RichTextLeaf> {
  const shape: Record<string, Validator<unknown>> = { text: str() };
  for (const mark of marks) shape[mark.key] = optional(mark.schema);
  return struct(shape) as unknown as Validator<RichTextLeaf>;
}

function unionOf(schemas: ReadonlyArray<Validator<unknown>>): Validator<unknown> {
  if (schemas.length === 0) throw new Error("rich-text: at least one element is required");
  return union(...schemas);
}

function buildRichTextSchema(
  elements: ReadonlyArray<RichTextElementDef>,
  marks: ReadonlyArray<RichTextMarkDef>,
): Validator<RichTextValue> {
  const leaf = buildLeafSchema(marks);
  // `node` resolves lazily so every element's `build(node)` closes over the
  // same recursive node validator.
  let node!: Validator<RichTextNode>;
  node = lazy(() =>
    unionOf([leaf, ...elements.map((e) => e.build(node))]),
  ) as Validator<RichTextNode>;
  // Top level is strictly an array of elements (no bare leaves at the root).
  return arrayOf(
    unionOf(elements.map((e) => e.build(node))),
  ) as unknown as Validator<RichTextValue>;
}

export function richText<const O extends RichTextOpts = RichTextOpts>(
  opts?: O,
): WithLocalized<RichTextValue, O, RichTextMeta> {
  const elements: ReadonlyArray<RichTextElementDef> =
    opts?.elements ?? (defaultElements as unknown as ReadonlyArray<RichTextElementDef>);
  const marks: ReadonlyArray<RichTextMarkDef> =
    opts?.marks ?? (defaultMarks as unknown as ReadonlyArray<RichTextMarkDef>);
  const meta: RichTextMeta = {
    kind: "richText",
    widget: "richText",
    elements: elements.map((e) => e.type),
    marks: marks.map((m) => m.key),
    plugins: opts?.plugins,
    components: opts?.components,
    toolbar: opts?.toolbar,
  };
  return applyCommon(buildRichTextSchema(elements, marks), opts, meta);
}
