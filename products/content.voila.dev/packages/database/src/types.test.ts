import { describe, test } from "bun:test";
import type {
  AnyDatabaseAdapter,
  DatabaseAdapter,
  DatabaseDialect,
  DatabaseDriver,
} from "./types.ts";

// Compile-time only — these tests pass as long as the file type-checks.

describe("DatabaseDialect", () => {
  test("accepts the documented values", () => {
    const sqlite: DatabaseDialect = "sqlite";
    const postgres: DatabaseDialect = "postgres";
    void sqlite;
    void postgres;
  });
});

describe("DatabaseDriver", () => {
  test("accepts the documented values", () => {
    const drivers: DatabaseDriver[] = ["better-sqlite3", "bun-sqlite", "d1", "postgres-js"];
    void drivers;
  });
});

describe("DatabaseAdapter", () => {
  test("narrows the drizzle type via the generic parameter", () => {
    type FakeD1Database = { __brand: "d1" };
    const adapter: DatabaseAdapter<FakeD1Database> = {
      dialect: "sqlite",
      driver: "d1",
      drizzle: { __brand: "d1" },
    };
    const branded: "d1" = adapter.drizzle.__brand;
    void branded;
  });

  test("close is optional and may be sync or async", () => {
    const syncClose: DatabaseAdapter = {
      dialect: "sqlite",
      driver: "better-sqlite3",
      drizzle: {},
      close: () => {},
    };
    const asyncClose: DatabaseAdapter = {
      dialect: "postgres",
      driver: "postgres-js",
      drizzle: {},
      close: async () => {},
    };
    const noClose: DatabaseAdapter = {
      dialect: "sqlite",
      driver: "d1",
      drizzle: {},
    };
    void syncClose;
    void asyncClose;
    void noClose;
  });

  test("AnyDatabaseAdapter accepts any concrete adapter", () => {
    type FakeDatabase = { run(): void };
    const concrete: DatabaseAdapter<FakeDatabase> = {
      dialect: "postgres",
      driver: "postgres-js",
      drizzle: { run: () => {} },
    };
    const any: AnyDatabaseAdapter = concrete;
    void any;
  });
});
