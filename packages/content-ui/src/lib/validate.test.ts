import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import {
  formatFieldIssue,
  issueMessageAt,
  issuesUnder,
  localizedFieldErrors,
  validateFields,
} from "./validate";

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

  test("keeps a localized field when any locale has content, dropping the blanks", () => {
    // The untranslated locale is omitted rather than persisted as an empty
    // document — reads fall back down the locale chain to fill the gap.
    const localized = { summary: fields.richText({ localized: true }) };
    const empty = [{ id: "1", type: "paragraph", children: [{ text: "" }] }];
    const filled = [{ id: "2", type: "paragraph", children: [{ text: "Hi" }] }];
    const { values, errors } = validateFields(localized, {
      summary: { "en-US": filled, "fr-FR": empty },
    });
    expect(errors).toEqual({});
    expect(values.summary).toEqual({ "en-US": filled });
  });

  test("a required localized field needs only the default locale", () => {
    const localized = { title: fields.string({ localized: true, required: true }) };
    const { values, errors } = validateFields(
      localized,
      { title: { "en-US": "Hello", "fr-FR": "" } },
      undefined,
      { locales: LOCALES, defaultLocale: "en-US" },
    );
    expect(errors).toEqual({});
    expect(values.title).toEqual({ "en-US": "Hello" });
  });

  test("a required localized field still fails when the DEFAULT locale is blank", () => {
    const localized = { title: fields.string({ localized: true, required: true }) };
    const { errors } = validateFields(
      localized,
      { title: { "en-US": "", "fr-FR": "Salut" } },
      undefined,
      { locales: LOCALES, defaultLocale: "en-US" },
    );
    expect(errors.title).toBe("Required.");
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

  test("only the DEFAULT locale is Required — a missing translation is clean", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, { "en-US": "Hello" }, LOCALES, "en-US");
    expect(out).toEqual({});
  });

  test("marks the default locale Required when it is the blank one", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, { "fr-FR": "Salut" }, LOCALES, "en-US");
    expect(out["en-US"]).toBe("Required.");
    expect("fr-FR" in out).toBe(false);
  });

  test("defaults the required locale to the first one when none is named", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, {}, LOCALES);
    expect(out["en-US"]).toBe("Required.");
    expect("fr-FR" in out).toBe(false);
  });

  test("does not flag a blank optional locale", () => {
    const field = fields.string({ localized: true });
    const out = localizedFieldErrors(field, { "en-US": "Hi" }, LOCALES);
    expect(out).toEqual({});
  });

  test("treats a non-record value as empty in the default locale", () => {
    const field = fields.string({ localized: true, required: true });
    const out = localizedFieldErrors(field, "garbage", LOCALES, "en-US");
    expect(out["en-US"]).toBe("Required.");
    expect("fr-FR" in out).toBe(false);
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

describe("nested issues", () => {
  const page = fields.blocks({
    types: { hero: { fields: { title: fields.string({ required: true }) } } },
  });

  test("validateFields keeps path-level issues and prefixes the field message", () => {
    const result = validateFields(
      { page },
      { page: [{ type: "hero", title: "ok" }, { type: "hero" }] },
    );
    expect(result.errors.page).toBe("[1].title: Required.");
    expect(result.issues.page).toEqual([{ path: [1, "title"], message: "Required." }]);
  });

  test("issuesUnder re-roots at a segment; issueMessageAt reads exact or nested", () => {
    const issues = [
      { path: [1, "title"], message: "Required." },
      { path: [2], message: "Expected a block" },
    ];
    expect(issuesUnder(issues, 1)).toEqual([{ path: ["title"], message: "Required." }]);
    expect(issuesUnder(undefined, 1)).toEqual([]);
    expect(issueMessageAt(issues, [2])).toBe("Expected a block");
    expect(issueMessageAt(issues, [1])).toBe("title: Required.");
    expect(issueMessageAt(issues, [0])).toBeUndefined();
    expect(formatFieldIssue({ path: [], message: "Bad." })).toBe("Bad.");
  });

  test("an empty list counts as blank for blocks and arrays", () => {
    const result = validateFields({ page }, { page: [] });
    expect(result.values).toEqual({});
    expect(result.errors).toEqual({});
  });
});
