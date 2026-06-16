// Datetime values through the whole write/read stack: a form emits a `Date`,
// the typed client `JSON.stringify`s it to an ISO-8601 string, the REST write
// path decodes it against the field schema, `Database` stores epoch ms, and
// every read returns epoch ms. This is the round trip the admin edit form
// drives (audit #8: the schema used to reject the ISO string the client sends,
// so no datetime could ever be written from the UI).

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import { type ContentClient, makeClient } from "./index";

const events = defineCollection({
  slug: "events",
  fields: {
    title: fields.string({ required: true }),
    startsAt: fields.datetime({ required: true }),
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { events } });

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
  return stmts;
}

let client: ContentClient<typeof config>;

beforeEach(async () => {
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  const handle = createRestHandler(ctx, { basePath: "/admin/api" });
  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };
  client = makeClient(config, { baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("datetime round trip (form → client → REST → DB → form)", () => {
  // What the edit widget emits for the datetime-local value "2026-06-08T10:30".
  const formValue = new Date(2026, 5, 8, 10, 30);

  it("creates with a Date (ISO on the wire) and reads back epoch ms", async () => {
    const created = await client.events.create({ title: "Launch", startsAt: formValue });
    // `Database.create` rereads the row, so the echo carries the stored form.
    expect(created.startsAt as unknown).toBe(formValue.getTime());

    const found = await client.events.find(created.id);
    expect(found?.startsAt as unknown).toBe(formValue.getTime());
  });

  it("updates with a Date and with a raw ISO string alike", async () => {
    const created = await client.events.create({ title: "Launch", startsAt: formValue });

    const moved = new Date(2026, 6, 1, 8, 15);
    const updated = await client.events.update(created.id, { startsAt: moved });
    expect(updated?.startsAt as unknown).toBe(moved.getTime());

    // A caller round-tripping the wire form directly (ISO string) works too.
    const iso = "2026-08-01T12:00:00.000Z";
    const again = await client.events.update(created.id, {
      startsAt: iso as unknown as Date,
    });
    expect(again?.startsAt as unknown).toBe(Date.parse(iso));
  });

  it("rejects an unparseable datetime with a 422 VALIDATION envelope", async () => {
    const error = await client.events
      .create({ title: "Bad", startsAt: "not a date" as unknown as Date })
      .catch((e: unknown) => e as { status: number; failure: { code: string } });
    expect((error as { status: number }).status).toBe(422);
    expect((error as { failure: { code: string } }).failure.code).toBe("VALIDATION");
  });
});
