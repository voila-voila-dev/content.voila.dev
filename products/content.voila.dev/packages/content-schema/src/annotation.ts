// VoilaField annotation namespace.
//
// Every field constructor in @voila/content-schema attaches a `VoilaField`
// annotation describing the DB column spec + UI hint. Downstream packages
// (@voila/content-sql for DDL, @voila/content for resolvers, the vended
// form layer for widget selection) read this annotation via `getFieldMeta`.

/**
 * Symbol used as the annotation key on every voila field schema.
 */
export const VoilaField: unique symbol = Symbol.for("@voila/content-schema/VoilaField");
export type VoilaField = typeof VoilaField;

/**
 * Metadata common to every field, regardless of kind.
 */
export interface BaseFieldMeta {
  /** Field kind discriminator (`"string"`, `"number"`, `"slug"`, ...). */
  readonly kind: string;
  /** Default widget identifier (consumed by the vended form layer). */
  readonly widget: string;
  /** Whether the field is required (decoded value must be present). */
  readonly required?: boolean;
  /** Human-readable label for the admin UI. */
  readonly label?: string;
  /** Short description rendered next to the widget. */
  readonly description?: string;
  /** Default value applied when the input is missing/undefined. */
  readonly default?: unknown;
  /** Whether the field is localized (one value per locale). */
  readonly localized?: boolean;
  /** Whether the field carries a `UNIQUE` DB constraint. */
  readonly unique?: boolean;
  /** Whether to add a secondary index in the DB. */
  readonly index?: boolean;
}

export interface StringFieldMeta extends BaseFieldMeta {
  readonly kind: "string";
  readonly widget: "string";
  readonly min?: number;
  readonly max?: number;
}

export interface NumberFieldMeta extends BaseFieldMeta {
  readonly kind: "number";
  readonly widget: "number";
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export interface BooleanFieldMeta extends BaseFieldMeta {
  readonly kind: "boolean";
  readonly widget: "boolean";
}

export interface DateFieldMeta extends BaseFieldMeta {
  readonly kind: "date";
  readonly widget: "date";
}

export interface DateTimeFieldMeta extends BaseFieldMeta {
  readonly kind: "datetime";
  readonly widget: "datetime";
}

export interface JsonFieldMeta extends BaseFieldMeta {
  readonly kind: "json";
  readonly widget: "json";
}

export interface SlugFieldMeta extends BaseFieldMeta {
  readonly kind: "slug";
  readonly widget: "slug";
  readonly derivedFrom?: string;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldMeta extends BaseFieldMeta {
  readonly kind: "select";
  readonly widget: "select";
  readonly options: readonly SelectOption[];
}

/**
 * Union of built-in field metas. Custom kinds registered via `defineField`
 * are described by the open `BaseFieldMeta`-extending interface.
 */
export type FieldMeta =
  | StringFieldMeta
  | NumberFieldMeta
  | BooleanFieldMeta
  | DateFieldMeta
  | DateTimeFieldMeta
  | JsonFieldMeta
  | SlugFieldMeta
  | SelectFieldMeta
  | BaseFieldMeta;
