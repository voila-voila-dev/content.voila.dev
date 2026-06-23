// Field metadata. Every voila field carries a `FieldMeta` (on `field.meta`)
// describing its kind, widget, validation hints, and DB-column overrides. The
// CLI's DDL deriver and any admin UI read this off the field directly — no
// schema-AST archaeology.

/**
 * The caller a field-access predicate decides about. Structurally identical to
 * the server's `Principal` (which is defined in `server/auth` — the config
 * layer stays client-safe, so the shape is mirrored here rather than imported).
 * `null` means the request is unauthenticated (no `Authenticator` configured,
 * or a public route).
 */
export interface FieldAccessPrincipal {
  readonly id: string;
  readonly email?: string;
  readonly roles?: ReadonlyArray<string>;
}

/** What a field-access predicate sees: who is asking, for what, and where. */
export interface FieldAccessContext {
  readonly principal: FieldAccessPrincipal | null;
  /** `read` covers every serialization of a row (list, find, write echoes). */
  readonly operation: "read" | "create" | "update";
  readonly collection: string;
  /** The targeted document, on routes that name one. */
  readonly documentId?: string;
}

/**
 * Per-field access rules. `read: false` redacts the field from every row the
 * REST layer serializes; `write: false` rejects a payload carrying the field
 * (403 `FORBIDDEN`). Predicates are synchronous — they run per field per row.
 * Omitted predicates allow. Enforcement lives at the REST boundary (the
 * runtime `Database` is principal-agnostic by design).
 */
export interface FieldAccess {
  readonly read?: (ctx: FieldAccessContext) => boolean;
  readonly write?: (ctx: FieldAccessContext) => boolean;
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
