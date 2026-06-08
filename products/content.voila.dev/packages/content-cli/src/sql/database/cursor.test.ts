import { describe, expect, it } from "bun:test";
import { Option } from "effect";
import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor", () => {
  it("round-trips a string-valued position", () => {
    const decoded = decodeCursor(
      encodeCursor({ value: "01HXYZ", id: "01HXYZ", orderBy: "id", direction: "desc" }),
    );
    expect(Option.getOrNull(decoded)).toEqual({
      value: "01HXYZ",
      id: "01HXYZ",
      orderBy: "id",
      direction: "desc",
    });
  });

  it("round-trips a number-valued position", () => {
    const decoded = decodeCursor(
      encodeCursor({
        value: 1700000000000,
        id: "post-9",
        orderBy: "publishedAt",
        direction: "asc",
      }),
    );
    expect(Option.getOrNull(decoded)).toEqual({
      value: 1700000000000,
      id: "post-9",
      orderBy: "publishedAt",
      direction: "asc",
    });
  });

  it("round-trips a null boundary value (trailing NULL partition)", () => {
    const decoded = decodeCursor(
      encodeCursor({ value: null, id: "post-3", orderBy: "rank", direction: "desc" }),
    );
    expect(Option.getOrNull(decoded)).toEqual({
      value: null,
      id: "post-3",
      orderBy: "rank",
      direction: "desc",
    });
  });

  it("emits a url-safe token (no +, /, or = padding)", () => {
    const token = encodeCursor({ value: "a/b+c==", id: "x?y", orderBy: "id", direction: "desc" });
    expect(token).not.toMatch(/[+/=]/);
  });

  it("returns None for a malformed cursor", () => {
    expect(Option.isNone(decodeCursor("not-base64-$$$"))).toBe(true);
    expect(Option.isNone(decodeCursor(btoa("{}")))).toBe(true);
    expect(Option.isNone(decodeCursor(btoa('["only-one"]')))).toBe(true);
    // Legacy 2-tuple cursors (pre orderBy/direction) are rejected.
    expect(Option.isNone(decodeCursor(btoa('["v","id"]')))).toBe(true);
    // Unknown direction.
    expect(Option.isNone(decodeCursor(btoa('["v","id","rank","sideways"]')))).toBe(true);
  });
});
