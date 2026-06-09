import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import { validateFields } from "./validate";

const schema = {
  title: fields.string({ required: true, min: 3 }),
  views: fields.number({ min: 0 }),
  tag: fields.string(),
};

describe("validateFields", () => {
  test("decodes valid values and omits empty optionals", () => {
    const { values, errors } = validateFields(schema, { title: "Hello", views: 5, tag: "" });
    expect(errors).toEqual({});
    expect(values).toEqual({ title: "Hello", views: 5 });
  });

  test("flags an empty required field as Required", () => {
    const { errors } = validateFields(schema, { title: "", views: 1 });
    expect(errors.title).toBe("Required.");
  });

  test("reports the field's own schema error message", () => {
    const { errors } = validateFields(schema, { title: "no", views: -1 });
    expect(errors.title).toBeDefined(); // min length
    expect(errors.views).toBeDefined(); // min 0
  });

  test("treats false and 0 as present, not empty", () => {
    const flag = { active: fields.boolean({ required: true }), count: fields.number() };
    const { values, errors } = validateFields(flag, { active: false, count: 0 });
    expect(errors).toEqual({});
    expect(values).toEqual({ active: false, count: 0 });
  });

  test("skips an empty optional without error", () => {
    const { values, errors } = validateFields(schema, { title: "okay" });
    expect(errors).toEqual({});
    expect("tag" in values).toBe(false);
  });

  test("honors an explicit key subset", () => {
    const { errors } = validateFields(schema, { views: 1 }, ["views"]);
    expect(errors).toEqual({}); // title not in the subset, so not required-checked
  });

  test("ignores unknown keys in the subset", () => {
    const { errors, values } = validateFields(schema, { title: "Hello" }, ["title", "nope"]);
    expect(errors).toEqual({});
    expect(values).toEqual({ title: "Hello" });
  });

  test("flags a field whose schema validates asynchronously", () => {
    // voila fields are sync; a field returning a Promise is a programming error
    // that must surface as an error rather than being silently awaited.
    const asyncField = {
      meta: { kind: "string" },
      "~standard": { version: 1, vendor: "x", validate: () => Promise.resolve({ value: "v" }) },
    } as unknown as (typeof schema)["title"];
    const { errors } = validateFields({ a: asyncField }, { a: "x" });
    expect(errors.a).toBe("Validation did not complete.");
  });
});
