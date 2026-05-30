import { describe, expect, it } from "bun:test";
import { Option } from "effect";
import { formatMigrationId, nextMigrationId, parseMigrationFile, splitStatements } from "./loader";

describe("parseMigrationFile", () => {
  it("parses a well-formed migration filename", () => {
    const parsed = parseMigrationFile("0007_add_posts.sql");
    expect(Option.isSome(parsed)).toBe(true);
    if (Option.isSome(parsed)) {
      expect(parsed.value).toEqual({ id: 7, name: "add_posts", file: "0007_add_posts.sql" });
    }
  });

  it("rejects non-migration filenames", () => {
    expect(Option.isNone(parseMigrationFile("notes.sql"))).toBe(true);
    expect(Option.isNone(parseMigrationFile("0001_init.ts"))).toBe(true);
    expect(Option.isNone(parseMigrationFile("README.md"))).toBe(true);
  });
});

describe("nextMigrationId", () => {
  it("returns 1 for an empty directory", () => {
    expect(nextMigrationId([])).toBe(1);
  });

  it("returns one past the highest numeric id, ignoring non-migrations", () => {
    expect(nextMigrationId(["0001_a.sql", "0002_b.sql", "junk.sql"])).toBe(3);
  });

  it("sorts numerically, not lexically", () => {
    expect(nextMigrationId(["0009_a.sql", "0010_b.sql"])).toBe(11);
  });
});

describe("formatMigrationId", () => {
  it("zero-pads to four digits and overflows gracefully", () => {
    expect(formatMigrationId(1)).toBe("0001");
    expect(formatMigrationId(42)).toBe("0042");
    expect(formatMigrationId(12345)).toBe("12345");
  });
});

describe("splitStatements", () => {
  it("splits on semicolons and drops blank fragments", () => {
    const sql = 'CREATE TABLE "a" ("id" TEXT);\n\nCREATE INDEX "i" ON "a" ("id");\n';
    expect(splitStatements(sql)).toEqual([
      'CREATE TABLE "a" ("id" TEXT)',
      'CREATE INDEX "i" ON "a" ("id")',
    ]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(splitStatements("  \n ; \n")).toEqual([]);
  });
});
