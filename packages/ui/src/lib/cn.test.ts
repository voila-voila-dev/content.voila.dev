import { describe, expect, test } from "bun:test";
import { cn } from "#lib/cn";

describe("cn", () => {
  test("joins class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("filters falsy values from clsx", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  test("merges conflicting tailwind utilities, last wins", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
