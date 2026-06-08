import { element, type Infer, integer, min, num, optional, refine } from "../_core";

export const tableCell = element("table-cell", {
  colspan: optional(refine(num(), integer(), min(1))),
  rowspan: optional(refine(num(), integer(), min(1))),
});

export type TableCellElement = Infer<ReturnType<typeof tableCell.build>>;
