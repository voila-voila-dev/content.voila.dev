// Field metadata. Every voila field carries a `FieldMeta` (on `field.meta`)
// describing its kind, widget, validation hints, and DB-column overrides. The
// CLI's DDL deriver and any admin UI read this off the field directly — no
// schema-AST archaeology.

export interface FieldAccess {
  readonly read?: (ctx: unknown) => boolean;
  readonly write?: (ctx: unknown) => boolean;
}

export interface FieldTransform<T = unknown> {
  readonly input?: (value: T) => T;
  readonly output?: (value: T) => T;
}

/** The common metadata every field carries, regardless of kind. */
export interface FieldMetaBase {
  readonly kind: string;
  readonly widget?: string;
  readonly localized?: boolean;
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly hidden?: boolean;
  readonly description?: string;
  readonly label?: string;
  readonly defaultValue?: unknown;
  readonly access?: FieldAccess;
  readonly transform?: FieldTransform;
  /** Override the generated DB column name; see `BaseFieldOpts.column`. */
  readonly column?: string;
}

/**
 * Field metadata, generic over the per-kind `Extra` payload. The wide
 * `FieldMeta` (no argument) is `FieldMetaBase` — used wherever a field is
 * handled regardless of kind (e.g. `Field.meta`, `applyCommon`). Each field
 * constructor authors its own `FieldMeta<{ … }>` so kind-specific keys
 * (`format`, `min`, `elements`, …) are typed at the construction site and
 * readable downstream.
 *
 * @example
 * type StringMeta = FieldMeta<{ format?: StringFormat; min?: number }>;
 */
export type FieldMeta<Extra = unknown> = FieldMetaBase & Extra;
