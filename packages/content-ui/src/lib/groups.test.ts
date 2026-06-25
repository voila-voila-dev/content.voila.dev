import { describe, expect, test } from "bun:test";
import { defineCollection, fields } from "@voila/content";
import { resolveFieldGroups } from "./groups";

const collection = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string(),
    body: fields.string(),
    seo: fields.string(),
    author: fields.string(),
    secret: fields.string({ hidden: true }),
  },
});

describe("resolveFieldGroups", () => {
  test("with no declared groups, returns one implicit General group of non-hidden fields", () => {
    const groups = resolveFieldGroups(collection);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("general");
    expect(groups[0]?.label).toBe("General");
    // `secret` is hidden → excluded.
    expect(groups[0]?.fieldKeys).toEqual(["title", "body", "seo", "author"]);
  });

  test("resolves declared groups in order, labels defaulting to humanize(id)", () => {
    const grouped = defineCollection({
      slug: "posts",
      fields: collection.fields,
      groups: [
        { id: "content", icon: "FileText", description: "The body", fields: ["title", "body"] },
        { id: "metaData", fields: ["seo"] },
      ],
    });
    const groups = resolveFieldGroups(grouped);
    expect(groups.map((g) => g.id)).toEqual(["content", "metaData", "general"]);
    expect(groups[0]?.label).toBe("Content");
    expect(groups[0]?.icon).toBe("FileText");
    expect(groups[0]?.description).toBe("The body");
    // `metaData` → humanized label.
    expect(groups[1]?.label).toBe("Meta Data");
    // `author` was named by no group → trailing General.
    expect(groups[2]?.id).toBe("general");
    expect(groups[2]?.fieldKeys).toEqual(["author"]);
  });

  test("dedupes a key across groups (first group wins) and drops emptied groups", () => {
    const grouped = defineCollection({
      slug: "posts",
      fields: collection.fields,
      groups: [
        { id: "a", fields: ["title", "body"] },
        // `body` already claimed by `a`; `secret` is hidden → this group empties.
        { id: "b", fields: ["body", "secret"] },
      ],
    });
    const groups = resolveFieldGroups(grouped);
    // `b` resolved to zero fields → dropped; leftovers (seo, author) → General.
    expect(groups.map((g) => g.id)).toEqual(["a", "general"]);
    expect(groups[0]?.fieldKeys).toEqual(["title", "body"]);
    expect(groups[1]?.fieldKeys).toEqual(["seo", "author"]);
  });

  test("merges leftovers into an author-declared 'general' group instead of duplicating it", () => {
    const grouped = defineCollection({
      slug: "posts",
      fields: collection.fields,
      groups: [
        { id: "content", fields: ["title"] },
        { id: "general", label: "Other", fields: ["body"] },
      ],
    });
    const groups = resolveFieldGroups(grouped);
    expect(groups.map((g) => g.id)).toEqual(["content", "general"]);
    // seo + author appended to the existing General, after its declared `body`.
    expect(groups[1]?.label).toBe("Other");
    expect(groups[1]?.fieldKeys).toEqual(["body", "seo", "author"]);
  });

  test("honors an explicit `fields` allow-list (incl. hidden) and its order", () => {
    const grouped = defineCollection({
      slug: "posts",
      fields: collection.fields,
      groups: [{ id: "content", fields: ["title", "secret"] }],
    });
    // Explicit fields include the hidden `secret` and exclude `seo`.
    const groups = resolveFieldGroups(grouped, { fields: ["secret", "title", "author"] });
    expect(groups[0]?.fieldKeys).toEqual(["title", "secret"]);
    // `author` is eligible (named in `fields`) but ungrouped → General.
    expect(groups[1]?.fieldKeys).toEqual(["author"]);
    // `seo` wasn't in the allow-list → absent entirely.
    expect(groups.flatMap((g) => g.fieldKeys)).not.toContain("seo");
  });
});
