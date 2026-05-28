// Sanity coverage for `NoopDatabaseLive` — every method fails with
// `DatabaseError({ cause: "NO_DATABASE" })` and the Layer resolves with no
// extra requirements (so it can satisfy a `database` config field anywhere).
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Database } from "./database.ts";
import { DatabaseError } from "./error.ts";
import { NoopDatabaseLive } from "./noop.ts";

describe("NoopDatabaseLive", () => {
  test("every method fails with DatabaseError({ cause: 'NO_DATABASE' })", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Database;
      const list = yield* Effect.either(db.list("posts", {}));
      const get = yield* Effect.either(db.get("posts", "x"));
      const insert = yield* Effect.either(db.insert("posts", {}));
      const update = yield* Effect.either(db.update("posts", "x", {}));
      const softDelete = yield* Effect.either(db.softDelete("posts", "x"));
      const restore = yield* Effect.either(db.restore("posts", "x"));
      return [list, get, insert, update, softDelete, restore] as const;
    });

    const outcomes = await Effect.runPromise(program.pipe(Effect.provide(NoopDatabaseLive)));
    for (const outcome of outcomes) {
      expect(outcome._tag).toBe("Left");
      if (outcome._tag === "Left") {
        expect(outcome.left).toBeInstanceOf(DatabaseError);
        expect(outcome.left.cause).toBe("NO_DATABASE");
      }
    }
  });
});
