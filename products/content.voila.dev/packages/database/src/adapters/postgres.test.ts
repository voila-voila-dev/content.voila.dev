import { describe, expect, test } from "bun:test";
import { postgres } from "./postgres.ts";

// Scaffold only — the real implementation (and its test suite covering URL
// parsing, connection lifecycle, drizzle roundtrips, etc.) lands in M2.

describe("postgres()", () => {
  test("throws a clear not-implemented error until M2", () => {
    expect(() => postgres({ url: "postgres://localhost/voila" })).toThrow(/M2/);
  });

  test.todo("returns an adapter tagged postgres + postgres-js", () => {});
  test.todo("opens a connection from a postgres:// URL", () => {});
  test.todo("runs a drizzle roundtrip", () => {});
  test.todo("close() releases the pool", () => {});
});
