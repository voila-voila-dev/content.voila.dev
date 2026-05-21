import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { resolveSqliteUrl, sqlite } from "./sqlite.ts";

const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

describe("resolveSqliteUrl", () => {
  test("treats :memory: as in-memory", () => {
    expect(resolveSqliteUrl(":memory:")).toBe(":memory:");
    expect(resolveSqliteUrl("file::memory:")).toBe(":memory:");
  });

  test("strips the file: prefix", () => {
    expect(resolveSqliteUrl("file:./data/voila.db")).toBe("./data/voila.db");
    expect(resolveSqliteUrl("file:/abs/voila.db")).toBe("/abs/voila.db");
  });

  test("passes bare paths through unchanged", () => {
    expect(resolveSqliteUrl("./voila.db")).toBe("./voila.db");
    expect(resolveSqliteUrl("/abs/voila.db")).toBe("/abs/voila.db");
  });
});

describe("sqlite()", () => {
  test("returns an adapter tagged sqlite + bun-sqlite", () => {
    const adapter = sqlite({ url: ":memory:" });
    expect(adapter.dialect).toBe("sqlite");
    expect(adapter.driver).toBe("bun-sqlite");
    adapter.close?.();
  });

  test("runs a drizzle roundtrip against an in-memory database", () => {
    const adapter = sqlite({ url: ":memory:" });
    adapter.drizzle.run(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`);

    adapter.drizzle.insert(users).values({ id: 1, name: "Alice" }).run();
    adapter.drizzle.insert(users).values({ id: 2, name: "Bob" }).run();
    const rows = adapter.drizzle.select().from(users).all();

    expect(rows).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    adapter.close?.();
  });

  describe("with file: URL", () => {
    let dir: string;

    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    test("opens a real file and persists across handles", () => {
      dir = mkdtempSync(join(tmpdir(), "voila-database-"));
      const path = join(dir, "data.db");

      const first = sqlite({ url: `file:${path}` });
      first.drizzle.run(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`);
      first.drizzle.insert(users).values({ id: 1, name: "Alice" }).run();
      first.close?.();

      const second = sqlite({ url: `file:${path}` });
      const rows = second.drizzle.select().from(users).all();
      expect(rows).toEqual([{ id: 1, name: "Alice" }]);
      second.close?.();
    });
  });

  test("close() releases the connection", () => {
    const adapter = sqlite({ url: ":memory:" });
    adapter.close?.();
    expect(() => adapter.drizzle.run(sql`SELECT 1`)).toThrow();
  });
});
