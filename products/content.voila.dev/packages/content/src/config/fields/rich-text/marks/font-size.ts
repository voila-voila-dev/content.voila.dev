import { Schema } from "effect";
import { defineMark } from "../_core";

// CSS length expression (`14px`, `1.125rem`, `var(--text-sm)`).
export const fontSize = defineMark({ key: "fontSize", schema: Schema.String });
