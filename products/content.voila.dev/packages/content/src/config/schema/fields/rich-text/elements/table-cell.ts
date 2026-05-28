import { Schema } from "effect";
import { element } from "../_core";

export const tableCell = element("table-cell", {
  colspan: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))),
  rowspan: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))),
});

export type TableCellElement = Schema.Schema.Type<ReturnType<typeof tableCell.build>>;
