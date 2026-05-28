import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type PasswordHash = "argon2id" | "bcrypt" | "scrypt";

export interface PasswordOpts extends BaseFieldOpts<string> {
  readonly hash?: PasswordHash;
  readonly min?: number;
}

/**
 * Hashed at rest, never returned from queries. The schema accepts a plaintext
 * string on write — the engine swaps it for the hash before persistence.
 */
export const password = <const O extends PasswordOpts = PasswordOpts>(
  opts?: O,
): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  let s: Schema.Schema.Any = Schema.String;
  if (o.min !== undefined) s = s.pipe(Schema.minLength(o.min));
  return applyCommon(s, o, {
    kind: "password",
    widget: "password",
    hash: o.hash ?? "argon2id",
    hidden: true,
  }) as WithLocalized<string, O>;
};
