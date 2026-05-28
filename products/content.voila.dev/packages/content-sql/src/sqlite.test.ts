import { describe, expect, test } from "bun:test";
import { SqlClient } from "@effect/sql";
import { Effect, ManagedRuntime } from "effect";
import { resolveSqliteUrl, SqliteLive } from "./sqlite.ts";

describe("resolveSqliteUrl", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    [":memory:", ":memory:"],
    ["file::memory:", ":memory:"],
    ["file:./local.db", "./local.db"],
    ["file:/tmp/x.db", "/tmp/x.db"],
    ["./bare.db", "./bare.db"],
    ["/abs/path.db", "/abs/path.db"],
  ];
  for (const [input, expected] of cases) {
    test(`${input} → ${expected}`, () => {
      expect(resolveSqliteUrl(input)).toBe(expected);
    });
  }
});

describe("SqliteLive", () => {
  test("provides a working SqlClient (SELECT 1 round-trip)", async () => {
    const runtime = ManagedRuntime.make(SqliteLive({ url: ":memory:" }));
    try {
      const rows = await runtime.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          return yield* sql`SELECT 1 as one`;
        }),
      );
      expect(rows).toEqual([{ one: 1 }]);
    } finally {
      await runtime.dispose();
    }
  });
});
