// The wire error envelope's human-readable `message` — what a direct (curl /
// non-JS) caller reads when it can't reconstruct one from the typed `code`.
// Exercises `failureMessage` across the structured-context codes and the
// per-code fallbacks, and pins the envelope shape `{ error, message }`.

import { describe, expect, it } from "bun:test";
import {
  type ApiFailure,
  badRequest,
  conflict,
  errorResponse,
  failureMessage,
  fieldNotUnique,
  forbidden,
  invalidCursor,
  invalidOrder,
  notFound,
  tooLarge,
  unauthorized,
  unknownCollection,
  unknownField,
  validation,
} from "./errors";

describe("failureMessage", () => {
  it("flattens a VALIDATION failure's issues to a sentence", () => {
    const msg = failureMessage(validation("posts", [{ path: ["title"], message: "Required." }]));
    expect(msg).toBe("title: Required.");
  });

  it("flattens a field-level FORBIDDEN failure's issues", () => {
    expect(failureMessage(forbidden("posts", "write", ["secret"]))).toContain("secret");
  });

  it("falls back to a default sentence for an issue-less CONFLICT", () => {
    expect(failureMessage(conflict("posts"))).toBe("A unique field already has this value.");
  });

  it("uses the structured context for resource-shaped codes", () => {
    expect(failureMessage(unknownCollection("widgets"))).toBe('Unknown collection "widgets".');
    expect(failureMessage(unknownField("posts", "nope"))).toBe('Unknown field "nope" on "posts".');
    expect(failureMessage(fieldNotUnique("posts", "slug"))).toContain('"slug"');
    expect(failureMessage(invalidOrder("posts", "body"))).toBe('Cannot order "posts" by "body".');
    expect(failureMessage(notFound("posts"))).toBe('No "posts" matched.');
    expect(failureMessage(tooLarge(1024))).toBe("The upload exceeds the maximum of 1024 bytes.");
  });

  it("has a fallback sentence for context-free codes", () => {
    expect(failureMessage(invalidCursor())).toContain("cursor");
    expect(failureMessage(unauthorized())).toContain("Authentication");
    expect(failureMessage(badRequest({ field: "x" }))).toContain("malformed");
  });
});

describe("errorResponse", () => {
  it("renders `{ error, message }` with the failure's status code", async () => {
    const res = errorResponse(notFound("posts"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: ApiFailure; message: string };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.message).toBe('No "posts" matched.');
  });
});
