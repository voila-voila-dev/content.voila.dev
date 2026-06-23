import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import { localizedFieldErrors, validateFields } from "./validate";

const LOCALES = ["en-US", "fr-FR"] as const;

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

  test("omits an optional localized field that is blank in every locale", () => {
    // The rich-text editor normalises an untouched field to an empty document on
    // mount; saving should leave the optional field absent, not persist the empties.
    const localized = { summary: fields.richText({ localized: true }) };
    const empty = [{ id: "1", type: "paragraph", children: [{ text: "" }] }];
    const { values, errors } = validateFields(localized, {
      summary: { "en-US": empty, "fr-FR": empty },
    });
    expect(errors).toEqual({});
    expect("summary" in values).toBe(false);
  });

  test("keeps a localized field when any locale has content", () => {
    const localized = { summary: fields.richText({ localized: true }) };
    const empty = [{ id: "1", type: "paragraph", children: [{ text: "" }] }];
    const filled = [{ id: "2", type: "paragraph", children: [{ text: "Hi" }] }];
    const { values, errors } = validateFields(localized, {
      summary: { "en-US": filled, "fr-FR": empty },
    });
    expect(errors).toEqual({});
    expect(values.summary).toEqual({ "en-US": filled, "fr-FR": empty });
  });

  test("flags a required localized field blank in every locale", () => {
    const localized = { summary: fields.richText({ localized: true, required: true }) };
    const empty = [{ id: "1", type: "paragraph", children: [{ text: "" }] }];
    const { errors } = validateFields(localized, { summary: { "en-US": empty, "fr-FR": empty } });
    expect(errors.summary).toBe("Required.");
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

describe("localizedFieldErrors", () => {
  test("reports the message only under the locale that failed", () => {
    const field = fields.string({ localized: true, required: true, min: 3 });
    // en-US is valid; fr-FR is too short → only fr-FR gets a message.
    const out = localizedFieldErrors(field, { "en-US": "Hello", "fr-FR": "no" }, LOCALES);
    expect(out["en-US"]).toBeUndefined();
    expect(out["fr-FR"]).toBeDefined();
  });

  test("marks a blank required locale Required, leaves a filled one clean", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, { "en-US": "Hello" }, LOCALES);
    expect(out["fr-FR"]).toBe("Required.");
    expect("en-US" in out).toBe(false);
  });

  test("does not flag a blank optional locale", () => {
    const field = fields.string({ localized: true });
    const out = localizedFieldErrors(field, { "en-US": "Hi" }, LOCALES);
    expect(out).toEqual({});
  });

  test("treats a non-record value as empty", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, "garbage", LOCALES);
    expect(out["en-US"]).toBe("Required.");
    expect(out["fr-FR"]).toBe("Required.");
  });

  test("surfaces a locale whose inner schema validates asynchronously", () => {
    const asyncField = {
      meta: { kind: "string", required: true, localized: true },
      inner: {
        meta: { kind: "string" },
        "~standard": { version: 1, vendor: "x", validate: () => Promise.resolve({ value: "v" }) },
      },
    } as unknown as ReturnType<typeof fields.string>;
    const out = localizedFieldErrors(asyncField, { "en-US": "x", "fr-FR": "y" }, LOCALES);
    expect(out["en-US"]).toBe("Validation did not complete.");
  });
});
