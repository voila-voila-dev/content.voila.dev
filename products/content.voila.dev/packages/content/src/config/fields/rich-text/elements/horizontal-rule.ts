import type { Schema } from "effect";
import { element } from "../_core";

export const horizontalRule = element("horizontal-rule", {});

export type HorizontalRuleElement = Schema.Schema.Type<ReturnType<typeof horizontalRule.build>>;
