import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export type ListStyle =
  | "disc"
  | "circle"
  | "square"
  | "decimal"
  | "lower-alpha"
  | "upper-alpha"
  | "lower-roman"
  | "upper-roman";

const listStyleSchema = Schema.Union(
  Schema.Literal("disc"),
  Schema.Literal("circle"),
  Schema.Literal("square"),
  Schema.Literal("decimal"),
  Schema.Literal("lower-alpha"),
  Schema.Literal("upper-alpha"),
  Schema.Literal("lower-roman"),
  Schema.Literal("upper-roman"),
);

export const paragraph = element("paragraph", {
  align: Schema.optional(alignSchema),
  indent: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  listStyleType: Schema.optional(listStyleSchema),
  listStart: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
});

export type ParagraphElement = Schema.Schema.Type<ReturnType<typeof paragraph.build>>;
