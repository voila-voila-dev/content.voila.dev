// Dialect normalization of raw driver rows. SQLite and Postgres return the same
// logical value in different JS shapes (a boolean as 0/1 vs true; a timestamp as
// epoch-ms INTEGER vs a Date; a BIGINT as number vs bigint; JSON as a string vs a
// parsed object). `mapRow` collapses both into one canonical document that the
// collection's field schemas decode. This pins that behaviour without needing a
// live Postgres (the pg client Layer itself lands in M2).

import { describe, expect, it } from "bun:test";
import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { deriveSchema } from "../ddl/derive-schema";
import { indexTable, mapRow } from "./database";

const events = defineCollection({
  slug: "events",
  fields: {
    active: fields.boolean(), // BOOLEAN / INTEGER 0-1
    publishedAt: fields.datetime(), // TIMESTAMPTZ / INTEGER ms
    readSeconds: fields.duration(), // BIGINT / INTEGER seconds
    payload: fields.json(), // JSONB / TEXT json
    releaseDate: fields.date(), // DATE / TEXT — stays a string
    views: fields.number(), // BIGINT / INTEGER
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { events } });
const eventsTable = deriveSchema(config).find((t) => t.name === "events");
if (eventsTable === undefined) throw new Error("events table not derived");
const table = indexTable(eventsTable);

const PUBLISHED = Date.UTC(2024, 0, 15, 9, 30);

const canonical = {
  id: "e1",
  createdAt: 1000,
  updatedAt: 2000,
  deletedAt: null,
  active: true,
  publishedAt: PUBLISHED,
  readSeconds: 300,
  payload: { a: 1 },
  releaseDate: "2024-01-15",
  views: 42,
};

describe("mapRow — dialect normalization", () => {
  it("normalizes Postgres-shaped values (Date, real boolean, bigint, parsed JSON)", () => {
    const doc = mapRow(table, {
      id: "e1",
      created_at: new Date(1000),
      updated_at: new Date(2000),
      deleted_at: null,
      active: true,
      published_at: new Date(PUBLISHED),
      read_seconds: 300n,
      payload: { a: 1 },
      release_date: "2024-01-15",
      views: 42,
    });
    expect(doc).toEqual(canonical);
  });

  it("normalizes SQLite-shaped values (0/1, epoch-ms number, JSON string) identically", () => {
    const doc = mapRow(table, {
      id: "e1",
      created_at: 1000,
      updated_at: 2000,
      deleted_at: null,
      active: 1,
      published_at: PUBLISHED,
      read_seconds: 300,
      payload: '{"a":1}',
      release_date: "2024-01-15",
      views: 42,
    });
    expect(doc).toEqual(canonical);
  });
});
