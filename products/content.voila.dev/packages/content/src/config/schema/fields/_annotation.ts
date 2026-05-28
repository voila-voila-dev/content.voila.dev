// Annotation symbol + metadata types attached to every voila field schema.

export const VoilaField = Symbol.for("@voila/content/field");

/**
 * Carries the unwrapped inner schema of a localized field so the
 * `defineConfig` resolver can re-wrap it with `Schema.Literal(...locales)`
 * as the record key. Stored under its own symbol because reading it back
 * from the wrapped `Schema.Record` AST is brittler than just keeping a
 * direct reference.
 */
export const VoilaInner = Symbol.for("@voila/content/field/inner");

export interface FieldAccess {
  readonly read?: (ctx: unknown) => boolean;
  readonly write?: (ctx: unknown) => boolean;
}

export interface FieldTransform<T = unknown> {
  readonly input?: (value: T) => T;
  readonly output?: (value: T) => T;
}

export interface FieldMeta {
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
  readonly [extraKey: string]: unknown;
}
