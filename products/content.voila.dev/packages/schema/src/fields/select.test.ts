import { describe, expect, test } from "bun:test";
import { select, selectOption, selectValues } from "./select.ts";

describe("select", () => {
  test("returns a select FieldDef carrying its options", () => {
    const field = select({ options: ["draft", "published"] });
    expect(field).toEqual({ kind: "select", options: ["draft", "published"] });
  });

  test("preserves shared FieldDef options", () => {
    const field = select({ options: ["a"], required: true, label: "Status" });
    expect(field.required).toBe(true);
    expect(field.label).toBe("Status");
  });
});

describe("selectOption", () => {
  test("expands the string shorthand to { label, value }", () => {
    expect(selectOption("draft")).toEqual({ label: "draft", value: "draft" });
  });

  test("passes the object form through unchanged", () => {
    expect(selectOption({ label: "Draft", value: "draft" })).toEqual({
      label: "Draft",
      value: "draft",
    });
  });
});

describe("selectValues", () => {
  test("lists the stored values in declaration order", () => {
    const field = select({ options: ["draft", { label: "Published", value: "pub" }] });
    expect(selectValues(field)).toEqual(["draft", "pub"]);
  });
});
