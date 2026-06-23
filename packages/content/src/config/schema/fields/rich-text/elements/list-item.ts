import { element, type Infer } from "../_core";

export const listItem = element("list-item", {});

export type ListItemElement = Infer<ReturnType<typeof listItem.build>>;
