import { element, type Infer } from "../_core";

export const table = element("table", {});

export type TableElement = Infer<ReturnType<typeof table.build>>;
