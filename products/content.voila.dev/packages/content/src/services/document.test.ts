import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { Database, type DatabaseShape } from "./database.ts";
import { DocumentLive, DocumentService } from "./document.ts";

const fakeDatabase: DatabaseShape = {
  list: () => Effect.succeed({ rows: [], nextCursor: null }),
  get: () => Effect.succeed(null),
  insert: (_c, row) => Effect.succeed(row),
  update: (_c, _id, patch) => Effect.succeed({ ...patch } as Record<string, unknown>),
  softDelete: () => Effect.void,
  restore: () => Effect.void,
};

describe("DocumentLive", () => {
  test("resolves DocumentService when Database is provided", async () => {
    const layer = DocumentLive.pipe(Layer.provide(Layer.succeed(Database, fakeDatabase)));

    const program = Effect.gen(function* () {
      const svc = yield* DocumentService;
      expect(typeof svc.list).toBe("function");
      expect(typeof svc.get).toBe("function");
      expect(typeof svc.findOne).toBe("function");
      return "ok" as const;
    });

    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result).toBe("ok");
  });
});
