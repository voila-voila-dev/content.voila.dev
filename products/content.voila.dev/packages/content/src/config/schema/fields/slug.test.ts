import { describe, expect, it } from "bun:test";
import { decodeSync, validateSync } from "../std";
import { slug, slugify } from "./slug";

describe("fields.slug", () => {
  it("accepts a well-formed slug and rejects malformed ones", () => {
    const f = slug({ from: "title" });
    expect(decodeSync(f, "hello-world")).toBe("hello-world");
    for (const bad of ["Hello", "hello world", "-hello", "hello-", "a--b", ""]) {
      expect(validateSync(f, bad).issues).toBeDefined();
    }
  });

  it("carries `from` and `reserved` in its meta", () => {
    const f = slug({ from: "title", reserved: ["admin"] });
    expect(f.meta.kind).toBe("slug");
    expect(f.meta.from).toBe("title");
    expect(f.meta.reserved).toEqual(["admin"]);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates word boundaries", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("My First Post!")).toBe("my-first-post");
  });

  it("strips diacritics", () => {
    expect(slugify("Crème brûlée à Noël")).toBe("creme-brulee-a-noel");
  });

  it("collapses non-alphanumeric runs and trims edge hyphens", () => {
    expect(slugify("  --foo___bar??baz--  ")).toBe("foo-bar-baz");
    expect(slugify("a   b")).toBe("a-b");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("always satisfies the slug field's own pattern", () => {
    const f = slug();
    for (const input of ["Hello, World!", "Éé Üü", "42 things", "foo_bar"]) {
      expect(validateSync(f, slugify(input)).issues).toBeUndefined();
    }
  });
});
