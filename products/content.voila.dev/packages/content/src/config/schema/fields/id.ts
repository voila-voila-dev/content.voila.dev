import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type IdOpts = BaseFieldOpts<string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Always UUID. Other formats (cuid2, ulid) are explicitly out of scope.
export const id = <const O extends IdOpts = IdOpts>(opts?: O): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String.pipe(Schema.pattern(UUID)), o, {
    kind: "id",
    widget: "id",
    unique: true,
    format: "uuid",
  }) as WithLocalized<string, O>;
};
