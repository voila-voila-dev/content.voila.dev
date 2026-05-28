import type { Schema } from "effect";
import { element } from "../_core";

export const tableRow = element("table-row", {});

export type TableRowElement = Schema.Schema.Type<ReturnType<typeof tableRow.build>>;
