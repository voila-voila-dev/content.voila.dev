import { describe, expect, test } from "bun:test";
import { defineField } from "./define-field.ts";

describe("defineField", () => {
  test("stamps the kind discriminator and preserves typed extras", () => {
    const rating = defineField<"rating", { max?: number }, number, { max: number }>(
      "rating",
      (opts) => ({ max: opts.max ?? 5, required: true }),
    );
    const field = rating({ max: 10 });
    expect(field.kind).toBe("rating");
    expect(field.required).toBe(true);
    // `max` is now part of the static type — no cast needed.
    expect(field.max).toBe(10);
  });

  test("calls build with empty options when none provided", () => {
    let captured: object | undefined;
    const noop = defineField<"noop", { tag?: string }, string>("noop", (opts) => {
      captured = opts;
      return {};
    });
    noop();
    expect(captured).toEqual({});
  });

  test("kind cannot be overridden by build output", () => {
    const tricky = defineField<"a", object, unknown>("a", () => ({
      ...({ kind: "b" } as unknown as object),
    }));
    expect(tricky().kind).toBe("a");
  });
});
