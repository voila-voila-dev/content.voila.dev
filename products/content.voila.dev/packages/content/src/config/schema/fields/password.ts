import { type Check, minLength, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type PasswordHash = "argon2id" | "bcrypt" | "scrypt";
export type PasswordMeta = FieldMeta<{ readonly hash?: PasswordHash }>;

export interface PasswordOpts extends BaseFieldOpts<string> {
  readonly hash?: PasswordHash;
  readonly min?: number;
}

/**
 * Hashed at rest, never returned from queries. The schema accepts a plaintext
 * string on write — the engine swaps it for the hash before persistence.
 */
export function password<const O extends PasswordOpts = PasswordOpts>(
  opts?: O,
): WithLocalized<string, O, PasswordMeta> {
  const checks: Check<string>[] = [];
  if (opts?.min !== undefined) checks.push(minLength(opts.min));
  const meta: PasswordMeta = {
    kind: "password",
    widget: "password",
    hash: opts?.hash ?? "argon2id",
    hidden: true,
  };
  return applyCommon(checks.length ? refine(str(), ...checks) : str(), opts, meta);
}
