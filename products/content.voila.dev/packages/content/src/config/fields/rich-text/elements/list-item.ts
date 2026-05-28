import type { Schema } from "effect";
import { element } from "../_core";

export const listItem = element("list-item", {});

export type ListItemElement = Schema.Schema.Type<ReturnType<typeof listItem.build>>;
