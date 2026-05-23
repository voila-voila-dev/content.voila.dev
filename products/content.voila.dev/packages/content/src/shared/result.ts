/**
 * `Result<T, E>` — explicit success / failure discriminator. The `ok` flag is
 * the only thing callers ever need to branch on.
 *
 * No default for `E`: every domain picks its own error union (see
 * `src/shared/errors.ts` for the `BaseError` shape every error extends), so
 * the type signature surfaces exactly which failures a function can produce.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
