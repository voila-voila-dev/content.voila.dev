import { element, type Infer, integer, min, num, optional, refine } from "../_core";

export const tableHeader = element("table-header", {
  colspan: optional(refine(num(), integer(), min(1))),
  rowspan: optional(refine(num(), integer(), min(1))),
});

export type TableHeaderElement = Infer<ReturnType<typeof tableHeader.build>>;
