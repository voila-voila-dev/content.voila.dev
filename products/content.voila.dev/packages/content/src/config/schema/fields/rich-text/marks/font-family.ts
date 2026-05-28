import { Schema } from "effect";
import { defineMark } from "../_core";

export const fontFamily = defineMark({ key: "fontFamily", schema: Schema.String });
