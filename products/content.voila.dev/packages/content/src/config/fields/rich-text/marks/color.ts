import { Schema } from "effect";
import { defineMark } from "../_core";

// Foreground text color — stored as any CSS color expression so the editor
// can pass through hex, rgb(), oklch(), or a design-system token name.
export const color = defineMark({ key: "color", schema: Schema.String });
