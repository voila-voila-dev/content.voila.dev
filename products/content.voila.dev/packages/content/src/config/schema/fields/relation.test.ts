import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { relation } from "./relation";

describe("fields.relation", () => {
  it("stores a single foreign-key id by default", () => {
    const f = relation({ to: "posts" });
    expect(decodeSync(f, "post-1")).toBe("post-1");
    expect(f.meta.kind).toBe("relation");
    expect(f.meta.to).toBe("posts");
    expect(f.meta.many).toBe(false);
    expect(f.meta.onDelete).toBe("restrict");
  });

  it("stores an array of ids when many", () => {
    const f = relation({ to: "tags", many: true, onDelete: "cascade", through: "post_tags" });
    expect(decodeSync(f, ["a", "b"])).toEqual(["a", "b"]);
    expect(f.meta.many).toBe(true);
    expect(f.meta.onDelete).toBe("cascade");
    expect(f.meta.through).toBe("post_tags");
  });

  it("carries an optional picker filter", () => {
    const filter = () => ({ published: true });
    const f = relation({ to: "posts", filter });
    expect(f.meta.filter).toBe(filter);
  });
});
