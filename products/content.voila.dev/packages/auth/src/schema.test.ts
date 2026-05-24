import { describe, expect, test } from "bun:test";
import { sqliteSchema } from "./schema.ts";

describe("sqliteSchema", () => {
  test("exposes the four better-auth tables under their singular names", () => {
    expect(Object.keys(sqliteSchema).sort()).toEqual([
      "account",
      "session",
      "user",
      "verification",
    ]);
  });
});
