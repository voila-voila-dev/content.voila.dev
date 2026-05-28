import { describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Database, DatabaseLive } from "./database.ts";
import { SqliteLive } from "./sqlite.ts";

describe("DatabaseLive", () => {
  test("resolves Database when given a SqlClient Layer", async () => {
    const AppLayer = DatabaseLive.pipe(Layer.provide(SqliteLive({ url: ":memory:" })));
    const runtime = ManagedRuntime.make(AppLayer);
    try {
      const db = await runtime.runPromise(
        Effect.gen(function* () {
          return yield* Database;
        }),
      );
      // M0 acceptance: methods exist on the service (even though they fail
      // with `DatabaseError({ cause: "M1" })` if invoked).
      expect(typeof db.list).toBe("function");
      expect(typeof db.get).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.softDelete).toBe("function");
      expect(typeof db.restore).toBe("function");
    } finally {
      await runtime.dispose();
    }
  });
});
