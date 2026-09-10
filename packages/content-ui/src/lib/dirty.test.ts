// Dirty tracking. The case that matters most is the one that caused the bug:
// a widget normalising its value on mount must not read as an edit, or merely
// opening a form arms the unsaved-changes guard and traps the editor.

import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import { dirtyFieldKeys, fieldIsDirty, valuesEqual } from "./dirty";

const title = fields.string();
const body = fields.richText();
const localizedTitle = fields.string({ localized: true });
const count = fields.number();

/** What the rich-text editor emits for an untouched field on mount. */
const EMPTY_DOC = [{ id: "1", type: "paragraph", children: [{ text: "" }] }];
const FILLED_DOC = [{ id: "1", type: "paragraph", children: [{ text: "Hello" }] }];

describe("valuesEqual", () => {
  test("compares scalars", () => {
    expect(valuesEqual("a", "a")).toBe(true);
    expect(valuesEqual("a", "b")).toBe(false);
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, undefined)).toBe(false);
  });

  test("compares arrays element-wise, length first", () => {
    expect(valuesEqual([1, 2], [1, 2])).toBe(true);
    expect(valuesEqual([1, 2], [2, 1])).toBe(false);
    expect(valuesEqual([1], [1, 2])).toBe(false);
  });

  test("compares plain objects by their own keys", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  test("walks nested structures", () => {
    expect(valuesEqual({ a: [{ b: 1 }] }, { a: [{ b: 1 }] })).toBe(true);
    expect(valuesEqual({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe(false);
  });

  test("an array and an object are never equal", () => {
    expect(valuesEqual([], {})).toBe(false);
  });
});

describe("fieldIsDirty", () => {
  test("an untouched rich-text field normalising on mount is NOT an edit", () => {
    // The regression this whole module exists for.
    expect(fieldIsDirty(body, undefined, EMPTY_DOC)).toBe(false);
    expect(fieldIsDirty(body, null, EMPTY_DOC)).toBe(false);
  });

  test("typing into that same field IS an edit", () => {
    expect(fieldIsDirty(body, EMPTY_DOC, FILLED_DOC)).toBe(true);
  });

  test("clearing a filled rich-text field back to empty IS an edit", () => {
    expect(fieldIsDirty(body, FILLED_DOC, EMPTY_DOC)).toBe(true);
  });

  test("blank spellings of nothing are all the same nothing", () => {
    expect(fieldIsDirty(title, undefined, "")).toBe(false);
    expect(fieldIsDirty(title, "", null)).toBe(false);
    expect(fieldIsDirty(title, null, undefined)).toBe(false);
  });

  test("a real string change is an edit", () => {
    expect(fieldIsDirty(title, "Hello", "Hello world")).toBe(true);
    expect(fieldIsDirty(title, "Hello", "Hello")).toBe(false);
  });

  test("zero is a value, not a blank", () => {
    expect(fieldIsDirty(count, undefined, 0)).toBe(true);
    expect(fieldIsDirty(count, 0, 0)).toBe(false);
  });

  test("a localized field compares locale by locale", () => {
    expect(fieldIsDirty(localizedTitle, { "en-US": "Hi" }, { "en-US": "Hi", "fr-FR": "" })).toBe(
      false,
    );
    expect(
      fieldIsDirty(localizedTitle, { "en-US": "Hi" }, { "en-US": "Hi", "fr-FR": "Salut" }),
    ).toBe(true);
  });

  test("an absent localized record and an all-blank one are the same", () => {
    expect(fieldIsDirty(localizedTitle, undefined, { "en-US": "", "fr-FR": "" })).toBe(false);
  });
});

describe("dirtyFieldKeys", () => {
  const schema = { title, body };

  test("a freshly opened form is clean even after widgets normalise", () => {
    const keys = dirtyFieldKeys(schema, ["title", "body"], {}, { body: EMPTY_DOC });
    expect(keys.size).toBe(0);
  });

  test("names only the fields that changed", () => {
    const keys = dirtyFieldKeys(
      schema,
      ["title", "body"],
      { title: "Old", body: EMPTY_DOC },
      { title: "New", body: EMPTY_DOC },
    );
    expect([...keys]).toEqual(["title"]);
  });

  test("ignores keys the form does not render", () => {
    const keys = dirtyFieldKeys(schema, ["title"], {}, { title: "x", body: FILLED_DOC });
    expect([...keys]).toEqual(["title"]);
  });

  test("ignores a key with no matching field", () => {
    const keys = dirtyFieldKeys(schema, ["nope"], {}, { nope: "x" });
    expect(keys.size).toBe(0);
  });
});
