// The pager's ordering logic. The component itself needs a router and a query
// client, so the part worth pinning in isolation is `siblingIds` — in
// particular that it goes quiet rather than guessing when the current record
// isn't on the loaded page, which is what stops the arrows lying on a long
// collection.

import { describe, expect, test } from "bun:test";
import { siblingIds } from "./record-pager";

const IDS = ["a", "b", "c"];

describe("siblingIds", () => {
  test("gives both neighbours in the middle", () => {
    expect(siblingIds(IDS, "b")).toEqual({ previous: "a", next: "c" });
  });

  test("has no previous at the head and no next at the tail", () => {
    expect(siblingIds(IDS, "a")).toEqual({ next: "b" });
    expect(siblingIds(IDS, "c")).toEqual({ previous: "b" });
  });

  test("offers nothing for a record outside the loaded page", () => {
    // Better no arrows than arrows that jump somewhere unrelated.
    expect(siblingIds(IDS, "zz")).toEqual({});
  });

  test("offers nothing for a collection of one", () => {
    expect(siblingIds(["only"], "only")).toEqual({});
  });

  test("handles an empty page", () => {
    expect(siblingIds([], "a")).toEqual({});
  });
});
