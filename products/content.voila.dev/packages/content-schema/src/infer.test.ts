// Type-level assertions for InferDoc / InferField. These tests intentionally
// have no runtime assertions beyond a placeholder — the value is that the file
// fails `tsc` if the inference drifts.

import { describe, expect, it } from "bun:test";
import { boolean } from "./fields/boolean.ts";
import { number } from "./fields/number.ts";
import { slug } from "./fields/slug.ts";
import { string } from "./fields/string.ts";
import type { InferDoc, InferField } from "./infer.ts";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const assert = <_T extends true>(): void => {};

describe("InferField / InferDoc", () => {
  it("InferField extracts the decoded value type", () => {
    const f = string({ min: 1 });
    type T = InferField<typeof f>;
    assert<Equals<T, string>>();
    const g = number();
    type N = InferField<typeof g>;
    assert<Equals<N, number>>();
    expect(true).toBe(true);
  });

  it("InferDoc walks a field map", () => {
    const fields = {
      title: string({ min: 1, required: true }),
      wordCount: number({ required: false }),
      published: boolean({ default: false }),
      postSlug: slug({ required: true }),
    };
    type Doc = InferDoc<typeof fields>;

    // Required keys (title, postSlug) must be present.
    // Optional keys (wordCount: required:false, published: has default) may be absent.
    const ok1: Doc = { title: "Hi", postSlug: "hi" };
    const ok2: Doc = { title: "Hi", postSlug: "hi", wordCount: 1, published: true };
    expect(ok1.title).toBe("Hi");
    expect(ok2.published).toBe(true);
  });
});
