import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content-schema";
import { isUniqueViolation, readJsonObject, uniqueViolationField } from "./write.ts";

const collectionFields = {
  title: fields.string({ required: true }),
  slugField: fields.string({ unique: true }),
};

function jsonReq(body: string): Request {
  return new Request("http://localhost/admin/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("readJsonObject", () => {
  test("parses a JSON object body", async () => {
    const result = await readJsonObject(jsonReq(JSON.stringify({ title: "x" })));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe("x");
  });

  test("400s on malformed JSON", async () => {
    const result = await readJsonObject(jsonReq("not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("BAD_REQUEST");
  });

  test("400s on a non-object JSON body (array / primitive)", async () => {
    expect((await readJsonObject(jsonReq("[1,2]"))).ok).toBe(false);
    expect((await readJsonObject(jsonReq("42"))).ok).toBe(false);
    expect((await readJsonObject(jsonReq("null"))).ok).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  test("recognizes the SQLite unique-constraint message", () => {
    expect(isUniqueViolation(new Error("UNIQUE constraint failed: posts.slug_field"))).toBe(true);
    expect(isUniqueViolation("UNIQUE constraint failed: posts.slug_field")).toBe(true);
  });

  test("ignores unrelated errors", () => {
    expect(isUniqueViolation(new Error("no such table: posts"))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("uniqueViolationField", () => {
  test("maps the offending snake_case column back to the field name", () => {
    const err = new Error("UNIQUE constraint failed: posts.slug_field");
    expect(uniqueViolationField(err, collectionFields)).toBe("slugField");
  });

  test("returns undefined when the column is unrecognized or unnamed", () => {
    expect(
      uniqueViolationField(new Error("UNIQUE constraint failed: posts.other"), collectionFields),
    ).toBeUndefined();
    expect(uniqueViolationField(new Error("some other error"), collectionFields)).toBeUndefined();
  });
});
