import { describe, expect, it } from "bun:test";
import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor", () => {
  it("round-trips a string-valued position", () => {
    const decoded = decodeCursor(
      encodeCursor({ value: "01HXYZ", id: "01HXYZ", orderBy: "id", direction: "desc" }),
    );
    expect(decoded).toEqual({
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
    expect(decoded).toEqual({
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
    expect(decoded).toEqual({
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

  it("returns null for a malformed cursor", () => {
    expect(decodeCursor("not-base64-$$$")).toBeNull();
    expect(decodeCursor(btoa("{}"))).toBeNull();
    expect(decodeCursor(btoa('["only-one"]'))).toBeNull();
    // Legacy 2-tuple cursors (pre orderBy/direction) are rejected.
    expect(decodeCursor(btoa('["v","id"]'))).toBeNull();
    // Unknown direction.
    expect(decodeCursor(btoa('["v","id","rank","sideways"]'))).toBeNull();
  });
});
