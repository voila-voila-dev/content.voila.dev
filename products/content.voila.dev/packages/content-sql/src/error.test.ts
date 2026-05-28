import { describe, expect, test } from "bun:test";
import { DatabaseError, MigrationError } from "./error.ts";

describe("DatabaseError", () => {
  test("carries _tag and cause", () => {
    const err = new DatabaseError({ cause: "x" });
    expect(err._tag).toBe("DatabaseError");
    expect(err.cause).toBe("x");
  });

  test("is an Error subclass", () => {
    const err = new DatabaseError({ cause: { reason: "boom" } });
    expect(err).toBeInstanceOf(Error);
  });
});

describe("MigrationError", () => {
  test("carries _tag and cause", () => {
    const err = new MigrationError({ cause: "y" });
    expect(err._tag).toBe("MigrationError");
    expect(err.cause).toBe("y");
  });
});
