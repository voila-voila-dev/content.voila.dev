// Session enforcement on the REST `HttpApi`. The api is built with `auth`, so
// `HttpSessionMiddleware` wraps every read: a request with no cookie gets the 401
// envelope off the wire, and a request carrying a session cookie minted through
// the real magic-link flow reads successfully. Mirrors `mount.auth.test.ts` for
// the RPC transport.

import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Layer } from "effect";
import { Auth } from "../auth/auth";
import { BetterAuthLive } from "../auth/better-auth";
import { Mailer } from "../auth/mailers/mailer";
import { authTableStatements } from "../auth/schema";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { toVoilaHttpApiWebHandler } from "./httpapi";

const SECRET = "test-secret-at-least-32-chars-long-xx";
const required = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);
  return value;
};

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const dbFile = `${tmpdir()}/voila-httpapi-auth-${Date.now()}.db`;
const sqlite = SqliteLive({ url: dbFile });

const mintSessionCookie = (): Promise<string> => {
  const links: string[] = [];
  const captureMailer = Layer.succeed(Mailer, {
    id: "capture",
    send: (m) => Effect.sync(() => void links.push(m.url)),
  });
  const authLayer = BetterAuthLive({ baseUrl: "http://localhost" }, { secret: SECRET }).pipe(
    Layer.provide(captureMailer),
    Layer.provide(sqlite),
  );
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const auth = yield* Auth;
        yield* auth.handler(
          new Request("http://localhost/admin/api/auth/sign-in/magic-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "admin@acme.com", callbackURL: "/admin" }),
          }),
        );
        const verify = yield* auth.handler(
          new Request(required(links[0], "magic-link URL"), { redirect: "manual" }),
        );
        return required(verify.headers.get("set-cookie")?.split(";")[0], "session cookie");
      }).pipe(Effect.provide(authLayer)),
    ),
  );
};

describe("HttpApi — session enforcement", () => {
  it("rejects unauthenticated reads (401 envelope) and serves authenticated ones", async () => {
    const ddl = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          for (const statement of [...ddl, ...authTableStatements]) yield* sql.unsafe(statement);
          yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
            "p1",
            "Hello",
            7,
          ]);
        }).pipe(Effect.provide(sqlite)),
      ),
    );
    const cookie = await mintSessionCookie();

    const database = makeDatabaseLayer(config).pipe(Layer.provide(sqlite));
    const auth = BetterAuthLive({ baseUrl: "http://localhost" }, { secret: SECRET }).pipe(
      Layer.provide(Layer.succeed(Mailer, { id: "noop", send: () => Effect.void })),
      Layer.provide(sqlite),
    );
    const rest = toVoilaHttpApiWebHandler(config, { database, auth });
    const server = Bun.serve({ port: 0, fetch: (request) => rest.handler(request) });
    const base = `http://localhost:${server.port}`;

    try {
      const denied = await fetch(`${base}/posts`);
      expect(denied.status).toBe(401);
      expect(await denied.json()).toEqual({
        error: { code: "UNAUTHORIZED", message: expect.any(String) },
      });

      const allowed = await fetch(`${base}/posts`, { headers: { cookie } });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as { documents: ReadonlyArray<{ id: string }> };
      expect(body.documents).toHaveLength(1);
      expect(body.documents[0]?.id).toBe("p1");
    } finally {
      server.stop(true);
      await rest.dispose();
      try {
        unlinkSync(dbFile);
      } catch {
        // best-effort cleanup
      }
    }
  });
});
