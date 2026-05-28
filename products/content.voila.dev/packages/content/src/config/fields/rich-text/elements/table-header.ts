import { Schema } from "effect";
import { element } from "../_core";

export const tableHeader = element("table-header", {
  colspan: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))),
  rowspan: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))),
});

export type TableHeaderElement = Schema.Schema.Type<ReturnType<typeof tableHeader.build>>;
