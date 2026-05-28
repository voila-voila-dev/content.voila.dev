import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { SelectFieldMeta } from "../annotation.ts";
import { getFieldMeta } from "../get-field-meta.ts";
import type { InferField } from "../infer.ts";
import { select } from "./select.ts";

describe("select field", () => {
  it("accepts string-only options", () => {
    const f = select({ options: ["draft", "published"] as const });
    expect(Schema.decodeUnknownSync(f)("draft")).toBe("draft");
    expect(Schema.decodeUnknownSync(f)("published")).toBe("published");
    expect(() => Schema.decodeUnknownSync(f)("archived")).toThrow();
  });

  it("accepts object options and normalizes them", () => {
    const f = select({
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
      ] as const,
    });
    expect(Schema.decodeUnknownSync(f)("draft")).toBe("draft");
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "select",
      widget: "select",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
      ],
    });
  });

  it("throws when no options provided", () => {
    expect(() => select({ options: [] })).toThrow();
  });

  it("normalises bare-string options to {value,label}", () => {
    const f = select({ options: ["a"], required: true, label: "Status", default: "a" });
    const meta = getFieldMeta<SelectFieldMeta>(f);
    expect(meta?.options).toEqual([{ value: "a", label: "a" }]);
    expect(meta).toMatchObject({ required: true, label: "Status", default: "a" });
  });

  it("narrows the decoded type to the literal union of option values", () => {
    const status = select({ options: ["draft", "published"] as const });
    type Status = InferField<typeof status>;
    // Compile-time assertion: Status must equal the literal union.
    const _exact: Status extends "draft" | "published"
      ? "draft" | "published" extends Status
        ? true
        : false
      : false = true;
    expect(_exact).toBe(true);

    const tag = select({
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ] as const,
    });
    type Tag = InferField<typeof tag>;
    const _tagExact: Tag extends "a" | "b" ? ("a" | "b" extends Tag ? true : false) : false = true;
    expect(_tagExact).toBe(true);
  });
});
