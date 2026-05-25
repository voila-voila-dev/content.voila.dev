import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildUpsertSql, seedAdmin } from "./seed-admin.ts";

const AUTH_MIGRATION = readFileSync(
  join(import.meta.dir, "..", "..", "..", "auth", "migrations", "0000_auth_init.sqlite.sql"),
  "utf8",
);

function freshDb(path: string) {
  const db = new Database(path);
  db.exec(AUTH_MIGRATION);
  return db;
}

describe("seedAdmin (sqlite target)", () => {
  test("inserts a verified admin row when the email is new", async () => {
    const path = `:memory:`;
    // Use a real file-backed sqlite so the CLI command (which opens its own
    // connection) sees the schema we set up here.
    const tmp = `/tmp/voila-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
    const setup = freshDb(tmp);
    setup.close();

    const result = await seedAdmin({
      email: "Ada@Example.COM",
      target: "sqlite",
      db: tmp,
      now: () => 1_700_000_000_000,
      idGenerator: () => "fixed-id-1",
    });

    expect(result.action).toBe("inserted");
    expect(result.email).toBe("ada@example.com");
    expect(result.id).toBe("fixed-id-1");

    const db = new Database(tmp);
    const row = db
      .query<{ id: string; email: string; emailVerified: number; name: string }, []>(
        'SELECT id, email, emailVerified, name FROM "user"',
      )
      .all();
    expect(row).toHaveLength(1);
    expect(row[0]?.email).toBe("ada@example.com");
    expect(row[0]?.emailVerified).toBe(1);
    expect(row[0]?.name).toBe("ada");
    db.close();
    void path; // silence unused
  });

  test("updates the existing row on a second run with the same email", async () => {
    const tmp = `/tmp/voila-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
    freshDb(tmp).close();

    await seedAdmin({
      email: "ada@example.com",
      target: "sqlite",
      db: tmp,
      idGenerator: () => "first-id",
      now: () => 1_700_000_000_000,
    });
    const second = await seedAdmin({
      email: "ada@example.com",
      name: "Ada Lovelace",
      target: "sqlite",
      db: tmp,
      idGenerator: () => "second-id-not-used",
      now: () => 1_700_000_999_999,
    });

    expect(second.action).toBe("updated");
    const db = new Database(tmp);
    const rows = db
      .query<{ id: string; name: string; updatedAt: number }, []>(
        'SELECT id, name, updatedAt FROM "user"',
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("first-id");
    expect(rows[0]?.name).toBe("Ada Lovelace");
    expect(rows[0]?.updatedAt).toBe(1_700_000_999_999);
    db.close();
  });

  test("throws when --email is missing", async () => {
    await expect(seedAdmin({ email: "", target: "sqlite", db: ":memory:" })).rejects.toThrow(
      /--email is required/,
    );
  });

  test("throws when --target sqlite is selected without --db", async () => {
    await expect(seedAdmin({ email: "x@y.z", target: "sqlite" })).rejects.toThrow(
      /--db is required when --target is "sqlite"/,
    );
  });

  test("throws when --target d1-local is selected without --binding", async () => {
    await expect(seedAdmin({ email: "x@y.z", target: "d1-local" })).rejects.toThrow(
      /--binding is required when --target is "d1-local"/,
    );
  });
});

describe("buildUpsertSql", () => {
  test("escapes single quotes in the email + name", () => {
    const sql = buildUpsertSql({
      id: "id-1",
      email: "o'malley@example.com",
      name: "O'Malley",
      now: 1700,
    });
    expect(sql).toContain("'o''malley@example.com'");
    expect(sql).toContain("'O''Malley'");
    expect(sql).toContain('ON CONFLICT("email")');
  });
});
