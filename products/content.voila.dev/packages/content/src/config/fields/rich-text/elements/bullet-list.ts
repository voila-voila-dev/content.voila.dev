import type { Schema } from "effect";
import { element } from "../_core";

export const bulletList = element("bullet-list", {});

export type BulletListElement = Schema.Schema.Type<ReturnType<typeof bulletList.build>>;
