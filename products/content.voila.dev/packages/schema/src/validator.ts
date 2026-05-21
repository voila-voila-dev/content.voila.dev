import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnyFieldDef } from "./types.ts";

export type ValidatorAdapter = (field: AnyFieldDef) => StandardSchemaV1;

export function toValidator(field: AnyFieldDef, adapter: ValidatorAdapter): StandardSchemaV1 {
  return adapter(field);
}
