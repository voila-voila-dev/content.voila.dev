import { describe, expect, it } from "bun:test";
import { ContentClientError } from "@voila/content/client";
import { errorMessage, fieldErrors } from "./field-errors";

describe("fieldErrors", () => {
  it("maps a VALIDATION envelope to per-field messages", () => {
    const err = new ContentClientError(422, {
      code: "VALIDATION",
      collectionSlug: "posts",
      issues: [{ path: ["title"], message: "Required" }],
    });
    expect(fieldErrors(err)).toEqual({ title: "Required" });
  });

  it("returns undefined for a non-field error", () => {
    expect(fieldErrors(new Error("network"))).toBeUndefined();
  });

  it("returns undefined for a client error with no field issues", () => {
    const err = new ContentClientError(403, { code: "FORBIDDEN" });
    expect(fieldErrors(err)).toBeUndefined();
  });
});

describe("errorMessage", () => {
  it("returns the message of an Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns undefined for non-Errors", () => {
    expect(errorMessage("nope")).toBeUndefined();
    expect(errorMessage(undefined)).toBeUndefined();
  });
});
