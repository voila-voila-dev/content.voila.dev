import { element, type Infer } from "../_core";

export const tableRow = element("table-row", {});

export type TableRowElement = Infer<ReturnType<typeof tableRow.build>>;
