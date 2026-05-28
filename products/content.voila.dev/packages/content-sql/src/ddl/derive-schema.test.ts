// Unit specs for `deriveSchema`. Golden DDL output is exercised separately
// by `generate-ddl.test.ts` — here we lock the *descriptor* shape (system
// columns prepended, validation errors, index emission, singleton checks).

import { describe, expect, test } from "bun:test";
import { boolean, date, datetime, json, number, select, slug, string } from "@voila/content-schema";
import { Schema } from "effect";
import { deriveSchema } from "./derive-schema.ts";

describe("deriveSchema", () => {
  test("prepends the four system columns in canonical order", () => {
    const [table] = deriveSchema([
      { kind: "collection", slug: "posts", fields: { title: string({ required: true }) } },
    ]);
    expect(table?.columns.map((c) => c.name)).toEqual([
      "id",
      "created_at",
      "updated_at",
      "deleted_at",
      "title",
    ]);
    expect(table?.columns[0]).toMatchObject({ kind: "id", primaryKey: true });
  });

  test("snake-cases user field names", () => {
    const [table] = deriveSchema([
      {
        kind: "collection",
        slug: "posts",
        fields: { publishedAt: datetime(), authorID: string() },
      },
    ]);
    const names = table?.columns.slice(4).map((c) => c.name);
    expect(names).toEqual(["published_at", "author_id"]);
  });

  test("maps every built-in field kind", () => {
    const [table] = deriveSchema([
      {
        kind: "collection",
        slug: "all_fields",
        fields: {
          str: string(),
          num: number(),
          int: number({ integer: true }),
          flag: boolean(),
          day: date(),
          moment: datetime(),
          payload: json(),
          status: select({ options: ["draft", "published"] }),
          path: slug(),
        },
      },
    ]);
    const userCols = table?.columns.slice(4) ?? [];
    expect(userCols.map((c) => `${c.name}:${c.kind}`)).toEqual([
      "str:string",
      "num:number",
      "int:integer",
      "flag:boolean",
      "day:date",
      "moment:datetime",
      "payload:json",
      "status:select",
      "path:slug",
    ]);
  });

  test("required and unique modifiers reach the descriptor", () => {
    const [table] = deriveSchema([
      {
        kind: "collection",
        slug: "posts",
        fields: {
          required: string({ required: true }),
          uniq: string({ unique: true }),
          plain: string(),
        },
      },
    ]);
    const userCols = table?.columns.slice(4) ?? [];
    expect(userCols.find((c) => c.name === "required")).toMatchObject({ notNull: true });
    expect(userCols.find((c) => c.name === "uniq")).toMatchObject({ unique: true });
    expect(userCols.find((c) => c.name === "plain")).toMatchObject({ notNull: false });
  });

  test("emits a CREATE INDEX for index:true (but not for unique fields)", () => {
    const [table] = deriveSchema([
      {
        kind: "collection",
        slug: "posts",
        fields: {
          indexed: number({ index: true }),
          uniqAndIndex: string({ unique: true, index: true }),
          plain: string(),
        },
      },
    ]);
    expect(table?.indexes).toEqual([{ name: "posts_indexed_idx", column: "indexed" }]);
  });

  test("singletons get a CHECK (id = '<slug>') constraint", () => {
    const [table] = deriveSchema([
      { kind: "singleton", slug: "site", fields: { title: string({ required: true }) } },
    ]);
    expect(table?.checks).toEqual([{ name: "site_singleton", expr: "id = 'site'" }]);
  });

  test("collections get no check constraints", () => {
    const [table] = deriveSchema([
      { kind: "collection", slug: "posts", fields: { title: string() } },
    ]);
    expect(table?.checks).toEqual([]);
  });

  test("rejects invalid slugs", () => {
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "1bad", fields: { title: string() } }]),
    ).toThrow(/invalid slug "1bad"/);
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "has space", fields: { title: string() } }]),
    ).toThrow(/invalid slug "has space"/);
  });

  test("rejects field names that collide with system columns", () => {
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "posts", fields: { id: string() } }]),
    ).toThrow(/collides with a reserved system column/);
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "posts", fields: { createdAt: datetime() } }]),
    ).toThrow(/collides with a reserved system column/);
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "posts", fields: { created_at: datetime() } }]),
    ).toThrow(/collides with a reserved system column/);
  });

  test("rejects field schemas missing the VoilaField annotation", () => {
    expect(() =>
      deriveSchema([{ kind: "collection", slug: "posts", fields: { naked: Schema.String } }]),
    ).toThrow(/missing the VoilaField annotation/);
  });
});
