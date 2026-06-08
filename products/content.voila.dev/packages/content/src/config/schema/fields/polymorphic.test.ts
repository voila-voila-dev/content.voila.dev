import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { polymorphic } from "./polymorphic";

describe("fields.polymorphic", () => {
  it("decodes a single typed reference by default", () => {
    const f = polymorphic({ to: ["posts", "pages"] });
    expect(decodeSync(f, { type: "posts", id: "1" })).toEqual({ type: "posts", id: "1" });
    expect(f.meta.kind).toBe("polymorphic");
    expect(f.meta.to).toEqual(["posts", "pages"]);
    expect(f.meta.many).toBe(false);
  });

  it("decodes an array of references when many", () => {
    const f = polymorphic({ to: ["posts"], many: true });
    expect(decodeSync(f, [{ type: "posts", id: "1" }])).toEqual([{ type: "posts", id: "1" }]);
    expect(f.meta.many).toBe(true);
  });

  it("rejects a malformed reference", () => {
    const f = polymorphic({ to: ["posts"] });
    expect(() => decodeSync(f, { type: "posts" })).toThrow();
  });
});
