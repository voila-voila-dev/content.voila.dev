import { pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type IdOpts = BaseFieldOpts<string>;
export type IdMeta = FieldMeta<{ readonly format?: "uuid" }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Always UUID. Other formats (cuid2, ulid) are explicitly out of scope.
export function id<const O extends IdOpts = IdOpts>(opts?: O): WithLocalized<string, O, IdMeta> {
  const meta: IdMeta = { kind: "id", widget: "id", unique: true, format: "uuid" };
  return applyCommon(refine(str(), patternCheck(UUID)), opts, meta);
}
