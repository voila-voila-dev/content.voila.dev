import {
  alignSchema,
  element,
  type Infer,
  integer,
  literal,
  min,
  num,
  optional,
  refine,
} from "../_core";

export type ListStyle =
  | "disc"
  | "circle"
  | "square"
  | "decimal"
  | "lower-alpha"
  | "upper-alpha"
  | "lower-roman"
  | "upper-roman";

const listStyleSchema = literal(
  "disc",
  "circle",
  "square",
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
);

export const paragraph = element("paragraph", {
  align: optional(alignSchema),
  indent: optional(refine(num(), integer(), min(0))),
  listStyleType: optional(listStyleSchema),
  listStart: optional(refine(num(), integer(), min(0))),
});

export type ParagraphElement = Infer<ReturnType<typeof paragraph.build>>;
