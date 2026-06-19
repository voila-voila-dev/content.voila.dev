import { str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type SecretOpts = BaseFieldOpts<string>;
export type SecretMeta = FieldMeta;

/**
 * Encrypted at rest with a KV-backed key. Read access is RBAC-gated; the
 * default API response masks the value.
 */
export function secret<const O extends SecretOpts = SecretOpts>(
  opts?: O,
): WithLocalized<string, O, SecretMeta> {
  const meta: SecretMeta = { kind: "secret", widget: "secret", hidden: true };
  return applyCommon(str(), opts, meta);
}
