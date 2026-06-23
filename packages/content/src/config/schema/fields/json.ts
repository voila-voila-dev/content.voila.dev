import { unknown } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type JsonOpts<T> = BaseFieldOpts<T>;
export type JsonMeta = FieldMeta;

/**
 * Free-form JSON. The runtime shape is `unknown`; consumers pin a TypeScript
 * type via the generic when they want stronger inference on the call site
 * without paying for full schema validation:
 *
 * ```ts
 * fields.json<{ ok: boolean }>()
 * ```
 */
export function json<T = unknown, const O extends JsonOpts<T> = JsonOpts<T>>(
  opts?: O,
): WithLocalized<T, O, JsonMeta> {
  const meta: JsonMeta = { kind: "json", widget: "json" };
  return applyCommon(unknown<T>(), opts, meta);
}
