import { Schema } from "effect";
import { defineMark } from "../_core";

export const backgroundColor = defineMark({ key: "backgroundColor", schema: Schema.String });
