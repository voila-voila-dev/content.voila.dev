// The collection-backed allowlist, exercised against a real in-memory SQLite
// database holding a config-derived `admins` table.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineAdminsCollection } from "../../config/admins";
import { defineConfig, type NormalizedConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import type { AccessRequest } from "./access";
import { allowlistAccess } from "./allowlist";
import type { AccessPolicyContext } from "./policy";

const config: NormalizedConfig = defineConfig({
  branding: { name: "Test" },
  collections: {
    admins: defineAdminsCollection(),
    staff: defineCollection({
      slug: "staff",
      fields: { contactEmail: fields.string({ required: true }), age: fields.number() },
    }),
  },
});

let driver: SqliteDriver;
let context: AccessPolicyContext;

async function createTables(): Promise<void> {
  for (const table of deriveSchema(config)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      if (c.defaultExpr?.sqlite) parts.push(`DEFAULT ${c.defaultExpr.sqlite}`);
      return parts.join(" ");
    });
    await driver.run(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
}

function request(email: string | undefined): AccessRequest {
  return { principal: { id: "u", email }, operation: "list", collection: "posts" };
}

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  await createTables();
  context = { driver, config, database: makeDatabase(config, driver) };
});

describe("allowlistAccess", () => {
  it("admits an email present in the collection, case-insensitively", async () => {
    await context.database.create("admins", { email: "Owner@x.dev" });
    const policy = allowlistAccess().build(context);
    expect(await policy.admits?.("owner@X.dev")).toBe(true);
    expect(await policy.access(request("OWNER@x.dev"))).toBe(true);
  });

  it("denies an unknown email, an empty one, and a principal without email", async () => {
    await context.database.create("admins", { email: "owner@x.dev" });
    const policy = allowlistAccess().build(context);
    expect(await policy.admits?.("stranger@x.dev")).toBe(false);
    expect(await policy.admits?.("   ")).toBe(false);
    expect(await policy.access(request(undefined))).toBe(false);
  });

  it("ignores soft-deleted rows", async () => {
    const doc = await context.database.create("admins", { email: "gone@x.dev" });
    await context.database.softDelete("admins", doc.id);
    const policy = allowlistAccess().build(context);
    expect(await policy.admits?.("gone@x.dev")).toBe(false);
  });

  it("reuses a verdict within the TTL and re-reads after it", async () => {
    let clock = 0;
    const policy = allowlistAccess({ ttlMs: 1000, now: () => clock }).build(context);
    expect(await policy.admits?.("late@x.dev")).toBe(false);
    await context.database.create("admins", { email: "late@x.dev" });
    // Still cached as denied.
    expect(await policy.admits?.("late@x.dev")).toBe(false);
    clock = 1001;
    expect(await policy.admits?.("late@x.dev")).toBe(true);
  });

  it("targets a custom collection and camelCase field", async () => {
    await context.database.create("staff", { contactEmail: "team@x.dev" });
    const policy = allowlistAccess({ collection: "staff", field: "contactEmail" }).build(context);
    expect(await policy.admits?.("team@x.dev")).toBe(true);
  });

  it("fails fast on a collection or field the config does not declare", () => {
    expect(() => allowlistAccess({ collection: "nope" }).build(context)).toThrow(
      /collection "nope"/,
    );
    expect(() => allowlistAccess({ collection: "staff", field: "age" }).build(context)).toThrow(
      /string field/,
    );
  });
});
