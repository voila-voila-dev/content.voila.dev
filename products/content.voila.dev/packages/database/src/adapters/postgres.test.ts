import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import type { Sql } from "postgres";
import { postgres } from "./postgres.ts";

// `runs a drizzle roundtrip` and `close() releases the pool` need a real
// Postgres. Set TEST_POSTGRES_URL (e.g. via docker compose in CI) to opt in;
// without it, the integration block is skipped.
const TEST_URL = process.env.TEST_POSTGRES_URL;

const users = pgTable("voila_database_postgres_test_users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

describe("postgres()", () => {
  test("returns an adapter tagged postgres + postgres-js", async () => {
    const adapter = postgres({ url: "postgres://localhost:5432/voila" });
    expect(adapter.dialect).toBe("postgres");
    expect(adapter.driver).toBe("postgres-js");
    await adapter.close?.();
  });

  test("opens a connection from a postgres:// URL", async () => {
    const adapter = postgres({
      url: "postgres://alice:secret@db.internal:6543/voila_prod",
    });
    const client = (adapter.drizzle as unknown as { $client: Sql }).$client;
    expect(client.options.host).toEqual(["db.internal"]);
    expect(client.options.port).toEqual([6543]);
    expect(client.options.user).toBe("alice");
    expect(client.options.database).toBe("voila_prod");
    await adapter.close?.();
  });

  describe.skipIf(!TEST_URL)("against TEST_POSTGRES_URL", () => {
    test("runs a drizzle roundtrip", async () => {
      const adapter = postgres({ url: TEST_URL as string });
      try {
        await adapter.drizzle.execute(sql`DROP TABLE IF EXISTS ${users}`);
        await adapter.drizzle.execute(
          sql`CREATE TABLE ${users} (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`,
        );
        await adapter.drizzle.insert(users).values([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]);
        const rows = await adapter.drizzle.select().from(users).orderBy(users.id);
        expect(rows).toEqual([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]);
      } finally {
        await adapter.drizzle.execute(sql`DROP TABLE IF EXISTS ${users}`);
        await adapter.close?.();
      }
    });

    test("close() releases the pool", async () => {
      const adapter = postgres({ url: TEST_URL as string });
      const client = (adapter.drizzle as unknown as { $client: Sql }).$client;
      await adapter.drizzle.execute(sql`SELECT 1`);
      await adapter.close?.();
      await expect(client`SELECT 1`).rejects.toThrow(/CONNECTION_ENDED|ended/i);
    });
  });
});
