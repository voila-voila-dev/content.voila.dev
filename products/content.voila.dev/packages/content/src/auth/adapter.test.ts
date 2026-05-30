// Integration: the Better Auth SqlClient adapter against real in-memory SQLite.
// Drives CRUD through better-auth's factory-wrapped adapter (the same surface
// better-auth itself calls) to prove the low-level SQL building: where
// operators, sortBy, count, date/boolean round-trips, and atomic `consumeOne`.

import { describe, expect, it } from "bun:test";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect } from "effect";
import { SqliteLive } from "../sql/client/sqlite";
import { makeVoilaSqlAdapter } from "./adapter";
import { authTableStatements } from "./schema";

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
}

// Build the wrapped adapter on the same in-memory connection, run `body`, all
// inside one scope so the connection stays open across the async adapter calls.
const withAdapter = <A>(
  // biome-ignore lint/suspicious/noExplicitAny: the better-auth adapter surface is opaque here.
  body: (adapter: any) => Promise<A>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.provide(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          for (const stmt of authTableStatements) yield* sql.unsafe(stmt);
          const runtime = yield* Effect.runtime<never>();
          // biome-ignore lint/suspicious/noExplicitAny: minimal options is enough for core tables.
          const adapter = makeVoilaSqlAdapter(sql, runtime)({} as any);
          return yield* Effect.promise(() => body(adapter));
        }),
        SqliteLive({ url: ":memory:" }),
      ),
    ),
  );

const seed = (adapter: { create: (a: unknown) => Promise<User> }) =>
  Promise.all(
    [
      { name: "Alice", email: "alice@acme.com" },
      { name: "Bob", email: "bob@acme.com" },
      { name: "Carol", email: "carol@example.com" },
    ].map((data) => adapter.create({ model: "user", data })),
  );

describe("makeVoilaSqlAdapter", () => {
  it("creates a row and reads it back with typed date/boolean values", async () => {
    const user = await withAdapter(async (adapter) => {
      const created: User = await adapter.create({
        model: "user",
        data: { name: "Alice", email: "alice@acme.com" },
      });
      return adapter.findOne({
        model: "user",
        where: [{ field: "id", value: created.id, operator: "eq", connector: "AND" }],
      });
    });
    expect(user?.email).toBe("alice@acme.com");
    expect(user?.emailVerified).toBe(false);
    expect(user?.createdAt).toBeInstanceOf(Date);
  });

  it("supports eq / contains / in operators and sortBy", async () => {
    const result = await withAdapter(async (adapter) => {
      await seed(adapter);
      const byEmail = await adapter.findOne({
        model: "user",
        where: [{ field: "email", value: "bob@acme.com", operator: "eq", connector: "AND" }],
      });
      const acme = await adapter.findMany({
        model: "user",
        where: [{ field: "email", value: "acme.com", operator: "contains", connector: "AND" }],
        sortBy: { field: "name", direction: "asc" },
      });
      const inList = await adapter.findMany({
        model: "user",
        where: [
          {
            field: "email",
            value: ["alice@acme.com", "carol@example.com"],
            operator: "in",
            connector: "AND",
          },
        ],
      });
      return { byEmail, acmeNames: acme.map((u: User) => u.name), inCount: inList.length };
    });
    expect(result.byEmail.name).toBe("Bob");
    expect(result.acmeNames).toEqual(["Alice", "Bob"]);
    expect(result.inCount).toBe(2);
  });

  it("counts, updates, and deletes", async () => {
    const result = await withAdapter(async (adapter) => {
      await seed(adapter);
      const count = await adapter.count({ model: "user" });
      const updated = await adapter.update({
        model: "user",
        where: [{ field: "email", value: "alice@acme.com", operator: "eq", connector: "AND" }],
        update: { emailVerified: true, name: "Alice A." },
      });
      const deleted = await adapter.deleteMany({
        model: "user",
        where: [{ field: "email", value: "example.com", operator: "ends_with", connector: "AND" }],
      });
      const remaining = await adapter.count({ model: "user" });
      return { count, updated, deleted, remaining };
    });
    expect(result.count).toBe(3);
    expect(result.updated.emailVerified).toBe(true);
    expect(result.updated.name).toBe("Alice A.");
    expect(result.deleted).toBe(1);
    expect(result.remaining).toBe(2);
  });

  it("consumeOne atomically deletes and returns a single row", async () => {
    const result = await withAdapter(async (adapter) => {
      await adapter.create({
        model: "verification",
        data: { identifier: "admin@acme.com", value: "tok", expiresAt: new Date(Date.now() + 1e6) },
      });
      const first = await adapter.consumeOne({
        model: "verification",
        where: [{ field: "identifier", value: "admin@acme.com", operator: "eq", connector: "AND" }],
      });
      const second = await adapter.consumeOne({
        model: "verification",
        where: [{ field: "identifier", value: "admin@acme.com", operator: "eq", connector: "AND" }],
      });
      return { first, second };
    });
    expect(result.first?.value).toBe("tok");
    expect(result.first?.expiresAt).toBeInstanceOf(Date);
    expect(result.second).toBeNull();
  });
});
