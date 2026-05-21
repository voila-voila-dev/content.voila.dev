import { describe, test } from "bun:test";
import type { boolean } from "./fields/boolean.ts";
import type { datetime } from "./fields/datetime.ts";
import { json } from "./fields/json.ts";
import { number } from "./fields/number.ts";
import { string } from "./fields/string.ts";
import type { InferDoc, InferField } from "./infer.ts";

// Compile-time only — these tests pass as long as the file type-checks.

describe("InferField", () => {
  test("maps each built-in field to its TS type", () => {
    type _StringT = InferField<ReturnType<typeof string>>;
    type _NumberT = InferField<ReturnType<typeof number>>;
    type _BoolT = InferField<ReturnType<typeof boolean>>;
    type _DateT = InferField<ReturnType<typeof datetime>>;
    type _JsonT = InferField<ReturnType<typeof json<{ x: number }>>>;

    const s: _StringT = "ok";
    const n: _NumberT = 1;
    const b: _BoolT = true;
    const d: _DateT = "2026-05-21T00:00:00Z";
    const j: _JsonT = { x: 1 };
    void s;
    void n;
    void b;
    void d;
    void j;
  });
});

describe("InferDoc", () => {
  test("required vs optional keys", () => {
    const schema = {
      title: string({ required: true }),
      views: number(),
      meta: json<{ tag: string }>({ required: true }),
    };
    type Doc = InferDoc<typeof schema>;

    const ok: Doc = { title: "x", meta: { tag: "a" } };
    void ok;

    const withOptional: Doc = { title: "x", views: 1, meta: { tag: "a" } };
    void withOptional;
  });
});
