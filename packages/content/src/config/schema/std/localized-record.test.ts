// `localizedRecord` is the validator behind every localized field. Its contract
// differs from plain `record` in one way that matters to editors: only the
// locales named in `required` have to be filled, so a monolingual team can save
// a `required` localized field and translators fill the rest later.

import { describe, expect, it } from "bun:test";
import { localizedRecord, str, validateSync } from "./index";

const LOCALES = ["en-US", "fr-FR"] as const;

describe("localizedRecord", () => {
  it("decodes the locales it is given", () => {
    const v = localizedRecord(str(), LOCALES);
    expect(validateSync(v, { "en-US": "Hi", "fr-FR": "Salut" })).toEqual({
      value: { "en-US": "Hi", "fr-FR": "Salut" },
    });
  });

  it("omits untranslated locales instead of failing", () => {
    const v = localizedRecord(str(), LOCALES);
    expect(validateSync(v, { "en-US": "Hi" })).toEqual({ value: { "en-US": "Hi" } });
    // A blank translation is dropped, not stored as an empty string.
    expect(validateSync(v, { "en-US": "Hi", "fr-FR": "" })).toEqual({ value: { "en-US": "Hi" } });
  });

  it("drops locales outside the project", () => {
    const v = localizedRecord(str(), LOCALES);
    expect(validateSync(v, { "en-US": "Hi", "de-DE": "Hallo" })).toEqual({
      value: { "en-US": "Hi" },
    });
  });

  it("fails only for a blank REQUIRED locale, under that locale's path", () => {
    const v = localizedRecord(str(), LOCALES, ["en-US"]);
    const result = validateSync(v, { "fr-FR": "Salut" });
    expect(result.issues?.[0]?.message).toBe("Required.");
    expect(result.issues?.[0]?.path).toEqual(["en-US"]);
    // The required locale filled is enough, even with every other locale empty.
    expect(validateSync(v, { "en-US": "Hi" })).toEqual({ value: { "en-US": "Hi" } });
  });

  it("still validates the values that are present", () => {
    const v = localizedRecord(str(), LOCALES, ["en-US"]);
    const result = validateSync(v, { "en-US": "Hi", "fr-FR": 42 });
    expect(result.issues?.[0]?.path).toEqual(["fr-FR"]);
  });

  it("rejects a non-object", () => {
    const v = localizedRecord(str(), LOCALES);
    expect(validateSync(v, "not a record").issues).toBeDefined();
    expect(validateSync(v, ["a"]).issues).toBeDefined();
    expect(validateSync(v, null).issues).toBeDefined();
  });
});
