// Atom factory (`makeVoilaAtoms`) against a real served `voilaRpc` app (loopback
// Bun.serve + HttpApp.toWebHandler), read through an `Atom.runtime`-backed
// registry. Asserts that list/find/findOne atoms decode the envelope into typed
// `Result`s and surface typed RPC errors. The explicit annotations below also
// pin the inference — they fail `tsc` if the config→atom doc type drifts.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { HttpApp } from "@effect/platform";
import { SqlClient } from "@effect/sql/SqlClient";
import { type Atom, Registry, Result } from "@effect-atom/atom";
import { Cause, Effect, Exit, Layer, Option, Scope } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "../server/mount";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { makeVoilaAtoms } from "./atoms";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const dbFile = `${tmpdir()}/voila-atoms-${Date.now()}.db`;

let server: ReturnType<typeof Bun.serve>;
let serverScope: Scope.CloseableScope;
let atoms: ReturnType<typeof makeVoilaAtoms<typeof config>>;
let registry: Registry.Registry;

// Subscribe to an atom and resolve once it settles into Success or Failure.
// Subscribing mounts the atom, which triggers evaluation; we unsubscribe as soon
// as the first settled value arrives.
const resolveAtom = <A, E>(atom: Atom.Atom<Result.Result<A, E>>): Promise<Result.Result<A, E>> =>
  new Promise((resolve) => {
    let unsub: (() => void) | undefined;
    unsub = registry.subscribe(
      atom,
      (result) => {
        if (Result.isSuccess(result) || Result.isFailure(result)) {
          unsub?.();
          resolve(result);
        }
      },
      { immediate: true },
    );
  });

beforeAll(async () => {
  const statements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        for (const statement of statements) yield* sql.unsafe(statement);
        for (const [id, title, views] of [
          ["p1", "First", 10],
          ["p2", "Second", 20],
        ] as const) {
          yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
            id,
            title,
            views,
          ]);
        }
      }).pipe(Effect.provide(SqliteLive({ url: dbFile }))),
    ),
  );

  serverScope = await Effect.runPromise(Scope.make());
  const database = makeDatabaseLayer(config).pipe(Layer.provide(SqliteLive({ url: dbFile })));
  const app = await Effect.runPromise(
    toVoilaRpcHttpApp(config, { database }).pipe(Effect.provideService(Scope.Scope, serverScope)),
  );
  const webHandler = HttpApp.toWebHandler(app);
  server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });

  atoms = makeVoilaAtoms(config, { url: `http://localhost:${server.port}${VOILA_RPC_PATH}` });
  registry = Registry.make();
});

afterAll(async () => {
  registry.dispose();
  server.stop(true);
  await Effect.runPromise(Scope.close(serverScope, Exit.void));
  try {
    unlinkSync(dbFile);
  } catch {
    // best-effort cleanup
  }
});

describe("makeVoilaAtoms", () => {
  it("list atom decodes the envelope into a typed page", async () => {
    const result = await resolveAtom(atoms.collections.posts.list({ limit: 1 }));
    expect(Result.isSuccess(result)).toBe(true);
    if (!Result.isSuccess(result)) throw new Error("expected success");
    expect(result.value.documents).toHaveLength(1);
    expect(result.value.nextCursor).not.toBeNull();
    const first = result.value.documents[0];
    if (first === undefined) throw new Error("expected a row");
    const title: string = first.title; // typed assertion
    expect(title).toBe("Second"); // id-desc: newest first
  });

  it("find atom resolves a typed document", async () => {
    const result = await resolveAtom(atoms.collections.posts.find("p1"));
    if (!Result.isSuccess(result)) throw new Error("expected success");
    const title: string = result.value.title;
    const views: number = result.value.views;
    expect(title).toBe("First");
    expect(views).toBe(10);
    expect(result.value.id).toBe("p1");
  });

  it("find atom surfaces the typed NotFound error", async () => {
    const result = await resolveAtom(atoms.collections.posts.find("absent"));
    expect(Result.isFailure(result)).toBe(true);
    if (!Result.isFailure(result)) throw new Error("expected failure");
    const error = Option.getOrNull(Cause.failureOption(result.cause));
    expect(error?._tag).toBe("NotFound");
  });

  it("findOne atom resolves nullably", async () => {
    const hit = await resolveAtom(
      atoms.collections.posts.findOne({ field: "title", value: "Second" }),
    );
    if (!Result.isSuccess(hit)) throw new Error("expected success");
    expect(hit.value?.id).toBe("p2");
    const miss = await resolveAtom(
      atoms.collections.posts.findOne({ field: "title", value: "nope" }),
    );
    if (!Result.isSuccess(miss)) throw new Error("expected success");
    expect(miss.value).toBeNull();
  });

  it("memoizes atoms structurally by input", () => {
    const a = atoms.collections.posts.list({ limit: 1 });
    const b = atoms.collections.posts.list({ limit: 1 });
    const c = atoms.collections.posts.list({ limit: 2 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(atoms.collections.posts.find("p1")).toBe(atoms.collections.posts.find("p1"));
  });
});
