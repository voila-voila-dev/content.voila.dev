import { element, type Infer } from "../_core";

export const bulletList = element("bullet-list", {});

export type BulletListElement = Infer<ReturnType<typeof bulletList.build>>;
