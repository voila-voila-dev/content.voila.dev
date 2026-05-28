import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type SecretOpts = BaseFieldOpts<string>;

/**
 * Encrypted at rest with a KV-backed key. Read access is RBAC-gated; the
 * default API response masks the value.
 */
export const secret = <const O extends SecretOpts = SecretOpts>(
  opts?: O,
): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String, o, {
    kind: "secret",
    widget: "secret",
    hidden: true,
  }) as WithLocalized<string, O>;
};
