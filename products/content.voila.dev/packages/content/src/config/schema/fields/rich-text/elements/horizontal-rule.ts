import { element, type Infer } from "../_core";

export const horizontalRule = element("horizontal-rule", {});

export type HorizontalRuleElement = Infer<ReturnType<typeof horizontalRule.build>>;
