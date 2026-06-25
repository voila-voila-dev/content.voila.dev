import { describe, expect, test } from "bun:test";
import { groupBy } from "./group-by";

const rows = [
  { id: "1", status: "draft", title: "A" },
  { id: "2", status: "published", title: "B" },
  { id: "3", status: "draft", title: "C" },
  { id: "4", title: "D" }, // no status → None
];

describe("groupBy", () => {
  test("buckets by distinct values in first-seen order (no declared columns)", () => {
    const cols = groupBy(rows, "status");
    expect(cols.map((c) => c.key)).toEqual(["draft", "published", ""]);
    expect(cols[0]?.rows.map((r) => r.id)).toEqual(["1", "3"]);
    expect(cols[2]?.label).toBe("None");
  });

  test("honors declared columns (order + empty columns) and a custom none label", () => {
    const cols = groupBy(rows, "status", {
      columns: [{ value: "published", label: "Live" }, { value: "archived" }, { value: "draft" }],
      noneLabel: "Unset",
    });
    // Declared order, including the empty `archived`, then the None bucket.
    expect(cols.map((c) => c.key)).toEqual(["published", "archived", "draft", ""]);
    expect(cols[0]?.label).toBe("Live");
    expect(cols[1]?.rows).toEqual([]);
    expect(cols[3]?.label).toBe("Unset");
  });

  test("appends an undeclared value as its own trailing column", () => {
    const cols = groupBy([{ id: "x", status: "weird" }], "status", {
      columns: [{ value: "draft" }],
    });
    expect(cols.map((c) => c.key)).toEqual(["draft", "weird"]);
    expect(cols[1]?.rows.map((r) => r.id)).toEqual(["x"]);
  });
});
