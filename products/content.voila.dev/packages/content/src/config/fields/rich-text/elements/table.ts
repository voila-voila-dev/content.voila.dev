import type { Schema } from "effect";
import { element } from "../_core";

export const table = element("table", {});

export type TableElement = Schema.Schema.Type<ReturnType<typeof table.build>>;
