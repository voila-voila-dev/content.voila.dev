import { defineMark, str } from "../_core";

// CSS length expression (`14px`, `1.125rem`, `var(--text-sm)`).
export const fontSize = defineMark({ key: "fontSize", schema: str() });
