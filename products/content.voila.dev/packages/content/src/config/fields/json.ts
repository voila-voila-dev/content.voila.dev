import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type JsonOpts<T> = BaseFieldOpts<T>;

/**
 * Free-form JSON. The runtime shape is `unknown`; consumers pin a TypeScript
 * type via the generic when they want stronger inference on the call site
 * without paying for full schema validation:
 *
 * ```ts
 * fields.json<{ ok: boolean }>()
 * ```
 */
export const json = <T = unknown, const O extends JsonOpts<T> = JsonOpts<T>>(
  opts?: O,
): WithLocalized<T, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.Unknown, o, { kind: "json", widget: "json" }) as WithLocalized<T, O>;
};
