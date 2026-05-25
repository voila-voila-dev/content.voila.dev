import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sqlite } from "@voila/content-database/sqlite";
import { consoleMailer } from "./mailers/console.ts";
import { createAuth, parseDurationSeconds } from "./server.ts";
import { DEFAULT_AUTH_CONFIG } from "./types.ts";

const MIGRATION_PATH = join(import.meta.dir, "..", "migrations", "0000_auth_init.sqlite.sql");

function freshDatabase() {
  const adapter = sqlite({ url: ":memory:" });
  // bun-sqlite returns the raw connection via drizzle's session — instead of
  // reaching into internals, exec the migration through a parallel handle on
  // the same in-memory db. (Each `:memory:` connection is independent, so we
  // need a single shared connection — easiest path is to back the adapter
  // with a `Database` we control.)
  return adapter;
}

describe("createAuth", () => {
  test("returns a Better Auth instance with handler + api surface", () => {
    const sqliteHandle = new Database(":memory:");
    sqliteHandle.exec(readFileSync(MIGRATION_PATH, "utf8"));
    const adapter = {
      dialect: "sqlite" as const,
      drizzle: (
        require("drizzle-orm/bun-sqlite") as typeof import("drizzle-orm/bun-sqlite")
      ).drizzle(sqliteHandle),
    };
    const auth = createAuth({
      config: DEFAULT_AUTH_CONFIG,
      adapter,
      secret: "0123456789abcdef0123456789abcdef",
      env: {},
      mailer: consoleMailer({ log() {} }),
      baseUrl: "http://localhost:8787",
    });
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.getSession).toBe("function");
    sqliteHandle.close();
  });

  test("rejects sessionTtl values that don't match the duration grammar", () => {
    expect(() => parseDurationSeconds("forever")).toThrow(/invalid sessionTtl/);
    expect(() => parseDurationSeconds("3 days")).toThrow(/invalid sessionTtl/);
  });

  test("parses common duration suffixes correctly", () => {
    expect(parseDurationSeconds("60s")).toBe(60);
    expect(parseDurationSeconds("30m")).toBe(1800);
    expect(parseDurationSeconds("24h")).toBe(86400);
    expect(parseDurationSeconds("7d")).toBe(604800);
    expect(parseDurationSeconds("2w")).toBe(1209600);
  });
});

// Suppress the "unused" lint on freshDatabase — kept as a future hook for
// schema-introspection tests when better-auth's table generator stabilises.
void freshDatabase;
