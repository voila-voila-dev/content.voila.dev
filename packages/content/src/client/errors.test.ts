// `ContentClientError` message shaping + the `issuesByField` form-mapping
// helper, across the failure codes that carry field-level detail. Pure unit
// coverage — the wire round-trip is exercised by `client.test.ts`.

import { describe, expect, it } from "bun:test";
import { ContentClientError, isContentClientError, issuesByField } from "./errors";

describe("ContentClientError.message", () => {
  it("summarizes VALIDATION issues with their paths", () => {
    const error = new ContentClientError(422, {
      code: "VALIDATION",
      collectionSlug: "posts",
      issues: [
        { path: ["title"], message: "Required." },
        { path: ["tags", 0], message: "Too long." },
      ],
    });
    expect(error.message).toBe("VALIDATION (422): title: Required. tags.0: Too long.");
  });

  it("renders a pathless issue without a dangling separator", () => {
    const error = new ContentClientError(422, {
      code: "VALIDATION",
      collectionSlug: "posts",
      issues: [{ path: [], message: "Malformed document." }],
    });
    expect(error.message).toBe("VALIDATION (422): Malformed document.");
  });

  it("names the colliding field on CONFLICT", () => {
    const error = new ContentClientError(409, {
      code: "CONFLICT",
      collectionSlug: "posts",
      issues: [{ path: ["slug"], message: "Already in use." }],
    });
    expect(error.message).toBe("CONFLICT (409): slug: Already in use.");
  });

  it("still explains a CONFLICT whose field the driver couldn't name", () => {
    const error = new ContentClientError(409, {
      code: "CONFLICT",
      collectionSlug: "posts",
      issues: [],
    });
    expect(error.message).toBe("CONFLICT (409): A unique field already has this value.");
  });

  it("lists the denied fields on a field-level FORBIDDEN", () => {
    const error = new ContentClientError(403, {
      code: "FORBIDDEN",
      collectionSlug: "posts",
      operation: "update",
      issues: [
        { path: ["secret"], message: "Not allowed." },
        { path: ["rank"], message: "Not allowed." },
      ],
    });
    expect(error.message).toBe("FORBIDDEN (403): secret: Not allowed. rank: Not allowed.");
  });

  it("stays code-only for failures without field detail or a server message", () => {
    expect(new ContentClientError(403, { code: "FORBIDDEN" }).message).toBe("FORBIDDEN (403)");
    expect(new ContentClientError(500, { code: "INTERNAL" }).message).toBe("INTERNAL (500)");
  });

  it("falls back to the server message when it has no field detail of its own", () => {
    // An operation-level FORBIDDEN (no per-field issues) reads as the server's
    // human summary instead of a bare code — what `ListView` shows a denied user.
    const denied = new ContentClientError(
      403,
      { code: "FORBIDDEN", collectionSlug: "posts", operation: "read" },
      "You don't have access to this resource.",
    );
    expect(denied.message).toBe("FORBIDDEN (403): You don't have access to this resource.");
  });

  it("prefers its own field detail over the server message", () => {
    // When the failure carries issues, the path-aware detail wins — the server
    // message is only a fallback for the code-only failures.
    const error = new ContentClientError(
      409,
      {
        code: "CONFLICT",
        collectionSlug: "posts",
        issues: [{ path: ["slug"], message: "Taken." }],
      },
      "A unique field already has this value.",
    );
    expect(error.message).toBe("CONFLICT (409): slug: Taken.");
  });
});

describe("issuesByField", () => {
  it("keys VALIDATION issues by top-level field, first issue winning", () => {
    expect(
      issuesByField({
        code: "VALIDATION",
        collectionSlug: "posts",
        issues: [
          { path: ["title"], message: "Required." },
          { path: ["title"], message: "Too short." },
          { path: ["tags", 1], message: "Too long." },
          { path: [], message: "Malformed." },
        ],
      }),
    ).toEqual({ title: "Required.", tags: "Too long." });
  });

  it("maps a CONFLICT to its colliding field", () => {
    expect(
      issuesByField({
        code: "CONFLICT",
        collectionSlug: "posts",
        issues: [{ path: ["slug"], message: "Already in use." }],
      }),
    ).toEqual({ slug: "Already in use." });
    expect(issuesByField({ code: "CONFLICT", collectionSlug: "posts", issues: [] })).toEqual({});
  });

  it("maps a field-level FORBIDDEN to each denied field", () => {
    expect(
      issuesByField({
        code: "FORBIDDEN",
        collectionSlug: "posts",
        issues: [{ path: ["secret"], message: "Not allowed." }],
      }),
    ).toEqual({ secret: "Not allowed." });
    expect(issuesByField({ code: "FORBIDDEN" })).toEqual({});
  });

  it("returns {} for form-level failures", () => {
    expect(issuesByField({ code: "INTERNAL" })).toEqual({});
    expect(issuesByField({ code: "NOT_FOUND", collectionSlug: "posts" })).toEqual({});
  });

  it("is exposed as a method on the error too", () => {
    const error = new ContentClientError(409, {
      code: "CONFLICT",
      collectionSlug: "posts",
      issues: [{ path: ["slug"], message: "Already in use." }],
    });
    expect(isContentClientError(error)).toBe(true);
    expect(error.issuesByField()).toEqual({ slug: "Already in use." });
  });
});
