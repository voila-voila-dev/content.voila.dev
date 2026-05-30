import { describe, expect, it } from "bun:test";
import { toErrorEnvelope } from "./envelope";
import { BadRequest, InternalError, NotFound } from "./errors";

describe("toErrorEnvelope", () => {
  it("maps NotFound to a NOT_FOUND envelope carrying its fields", () => {
    expect(toErrorEnvelope(new NotFound({ collection: "posts", id: "p9" }))).toEqual({
      error: { code: "NOT_FOUND", collection: "posts", id: "p9" },
    });
  });

  it("maps BadRequest to a BAD_REQUEST envelope", () => {
    expect(toErrorEnvelope(new BadRequest({ message: "bad orderBy" }))).toEqual({
      error: { code: "BAD_REQUEST", message: "bad orderBy" },
    });
  });

  it("maps InternalError to an INTERNAL envelope", () => {
    expect(toErrorEnvelope(new InternalError({ message: "boom" }))).toEqual({
      error: { code: "INTERNAL", message: "boom" },
    });
  });
});
