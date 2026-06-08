// The SQL adapter driven directly through Better Auth's adapter surface (the
// `(options) => adapter` factory result), against an in-memory SQLite driver
// holding the real auth tables. Exercises every `where` operator, the
// date/boolean value round-trip, pagination, the bulk mutations, and the atomic
// `consumeOne` — the paths the magic-link e2e doesn't naturally reach.

import { beforeEach, describe, expect, it } from "bun:test";
import { authTableStatements } from "../../../sql/auth-schema";
import { makeSqliteDriver } from "../../database/sqlite-driver";
import { makeSqlAdapter } from "./adapter";

// The Better Auth adapter is opaquely typed; this test pokes it directly, so a
// local loose alias keeps the call sites readable without leaking `any` around.
// biome-ignore lint/suspicious/noExplicitAny: exercising Better Auth's opaque adapter surface directly.
type Adapter = any;
interface Where {
  field: string;
  value: unknown;
  operator: string;
  connector: "AND" | "OR";
}
const where = (field: string, operator: string, value: unknown): Where => ({
  field,
  operator,
  value,
  connector: "AND",
});

let adapter: Adapter;

async function createUser(email: string, name: string, createdAt: Date, verified = false) {
  return adapter.create({
    model: "user",
    data: { email, name, emailVerified: verified, createdAt, updatedAt: createdAt },
  });
}

beforeEach(async () => {
  const driver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of authTableStatements) await driver.run(statement);
  adapter = makeSqlAdapter(driver)({});
  await createUser("alice@x.dev", "Alice", new Date(1000), true);
  await createUser("bob@x.dev", "Bob", new Date(2000), false);
  await createUser("carol@y.dev", "Carol", new Date(3000), false);
});

describe("value round-trip", () => {
  it("rebuilds Date and boolean columns from their stored INTEGER form", async () => {
    const alice = await adapter.findOne({
      model: "user",
      where: [where("email", "eq", "alice@x.dev")],
    });
    expect(alice.name).toBe("Alice");
    expect(alice.emailVerified).toBe(true);
    expect(alice.createdAt).toBeInstanceOf(Date);
    expect(alice.createdAt.getTime()).toBe(1000);
  });
});

describe("where operators", () => {
  const names = async (w: Where[]): Promise<string[]> =>
    (await adapter.findMany({ model: "user", where: w }))
      .map((u: { name: string }) => u.name)
      .sort();

  it("eq / ne", async () => {
    expect(await names([where("name", "eq", "Bob")])).toEqual(["Bob"]);
    expect(await names([where("name", "ne", "Bob")])).toEqual(["Alice", "Carol"]);
  });

  it("lt / lte / gt / gte on a date column", async () => {
    expect(await names([where("createdAt", "lt", new Date(2000))])).toEqual(["Alice"]);
    expect(await names([where("createdAt", "lte", new Date(2000))])).toEqual(["Alice", "Bob"]);
    expect(await names([where("createdAt", "gt", new Date(2000))])).toEqual(["Carol"]);
    expect(await names([where("createdAt", "gte", new Date(2000))])).toEqual(["Bob", "Carol"]);
  });

  it("contains / starts_with / ends_with", async () => {
    expect(await names([where("email", "contains", "x.dev")])).toEqual(["Alice", "Bob"]);
    expect(await names([where("name", "starts_with", "A")])).toEqual(["Alice"]);
    expect(await names([where("email", "ends_with", "y.dev")])).toEqual(["Carol"]);
  });

  it("in / not_in, including the empty-array edges", async () => {
    expect(await names([where("name", "in", ["Alice", "Carol"])])).toEqual(["Alice", "Carol"]);
    expect(await names([where("name", "not_in", ["Alice"])])).toEqual(["Bob", "Carol"]);
    expect(await names([where("name", "in", [])])).toEqual([]);
    expect(await names([where("name", "not_in", [])])).toEqual(["Alice", "Bob", "Carol"]);
  });

  it("escapes LIKE wildcards in user input", async () => {
    // The literal "%" must not match everything — it's escaped, so nothing hits.
    expect(await names([where("name", "contains", "%")])).toEqual([]);
  });
});

describe("pagination", () => {
  it("orders, limits, and offsets", async () => {
    const page = await adapter.findMany({
      model: "user",
      sortBy: { field: "createdAt", direction: "desc" },
      limit: 1,
      offset: 1,
    });
    expect(page.map((u: { name: string }) => u.name)).toEqual(["Bob"]);
  });
});

describe("count + bulk mutations", () => {
  it("counts all and filtered", async () => {
    expect(await adapter.count({ model: "user" })).toBe(3);
    expect(
      await adapter.count({ model: "user", where: [where("emailVerified", "eq", true)] }),
    ).toBe(1);
  });

  it("update returns the patched row", async () => {
    const updated = await adapter.update({
      model: "user",
      where: [where("email", "eq", "bob@x.dev")],
      update: { name: "Bobby" },
    });
    expect(updated.name).toBe("Bobby");
  });

  it("updateMany returns the affected count", async () => {
    const n = await adapter.updateMany({
      model: "user",
      where: [where("email", "contains", "x.dev")],
      update: { emailVerified: true },
    });
    expect(n).toBe(2);
    // Alice + Bob (the x.dev users) are now verified; Carol (y.dev) untouched.
    expect(
      await adapter.count({ model: "user", where: [where("emailVerified", "eq", true)] }),
    ).toBe(2);
  });

  it("delete removes one and deleteMany returns the count", async () => {
    await adapter.delete({ model: "user", where: [where("email", "eq", "alice@x.dev")] });
    expect(await adapter.count({ model: "user" })).toBe(2);
    const n = await adapter.deleteMany({
      model: "user",
      where: [where("email", "ends_with", "x.dev")],
    });
    expect(n).toBe(1);
    expect(await adapter.count({ model: "user" })).toBe(1);
  });
});

describe("consumeOne", () => {
  it("atomically deletes and returns a single matching row", async () => {
    await adapter.create({
      model: "verification",
      data: {
        identifier: "magic",
        value: "tok-1",
        expiresAt: new Date(9_999_999),
        createdAt: new Date(1),
        updatedAt: new Date(1),
      },
    });
    const consumed = await adapter.consumeOne({
      model: "verification",
      where: [where("value", "eq", "tok-1")],
    });
    expect(consumed.identifier).toBe("magic");
    expect(consumed.expiresAt).toBeInstanceOf(Date);
    // Gone after consumption — the one-time-token guarantee.
    expect(await adapter.count({ model: "verification" })).toBe(0);
    const again = await adapter.consumeOne({
      model: "verification",
      where: [where("value", "eq", "tok-1")],
    });
    expect(again).toBeNull();
  });
});
