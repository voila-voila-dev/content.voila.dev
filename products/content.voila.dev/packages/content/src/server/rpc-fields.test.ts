// Wire round-trip for fields whose schema `Type` differs from their stored
// `Encoded` form. The handler decodes the raw DB row through the collection
// schema, RPC re-encodes for the wire, and the typed client decodes again — so a
// `datetime` stored as epoch ms surfaces as a `Date`, a localized field stored as
// JSON surfaces as a per-locale record, and a `date` stays an ISO string. The
// explicit annotations also assert the client types.

import { describe, expect, it } from "bun:test";
import { RpcTest } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Layer } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { CsrfMiddlewareTestLive } from "./csrf";
import { makeVoilaRpcHandlers } from "./handlers";
import { makeVoilaRpc } from "./rpc";

const articles = defineCollection({
  slug: "articles",
  fields: {
    title: fields.string({ localized: true }), // JSON column → per-locale record
    releaseDate: fields.date(), // TEXT column → ISO date string
    publishedAt: fields.datetime(), // INTEGER column (epoch ms) → Date
    featured: fields.boolean(), // INTEGER column (0/1) → boolean
    readSeconds: fields.duration(), // INTEGER column (seconds) → number
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { articles },
});

const schemaStatements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));

const PUBLISHED_AT = Date.UTC(2024, 0, 15, 9, 30); // epoch ms, as the column stores it

const bootstrap = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const statement of schemaStatements) yield* sql.unsafe(statement);
  yield* sql.unsafe(
    "INSERT INTO articles (id, title, release_date, published_at, featured, read_seconds, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      "a1",
      JSON.stringify({ "en-US": "Hello", "fr-FR": "Bonjour" }),
      "2024-01-15",
      PUBLISHED_AT,
      1, // SQLite stores booleans as 0/1
      300, // seconds
      null,
    ],
  );
});

const group = makeVoilaRpc(config);
const layer = makeVoilaRpcHandlers(config).pipe(
  Layer.provideMerge(
    makeDatabaseLayer(config).pipe(Layer.provideMerge(SqliteLive({ url: ":memory:" }))),
  ),
  Layer.merge(CsrfMiddlewareTestLive), // writes declare CsrfMiddleware; permissive here
);
const clientEffect = RpcTest.makeClient(group);

const run = <A, E>(
  body: (client: Effect.Effect.Success<typeof clientEffect>) => Effect.Effect<A, E, never>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.provide(bootstrap.pipe(Effect.zipRight(Effect.flatMap(clientEffect, body))), layer),
    ),
  );

describe("voilaRpc — Type ≠ Encoded fields round-trip", () => {
  it("surfaces datetime (epoch ms → Date), date (ISO string), localized (JSON → record)", async () => {
    const doc = await run((client) => client.articles.find({ id: "a1" }));

    // datetime: stored as epoch ms, decoded to a Date
    const publishedAt: Date = doc.publishedAt;
    expect(publishedAt).toBeInstanceOf(Date);
    expect(publishedAt.getTime()).toBe(PUBLISHED_AT);

    // date: stored + surfaced as a plain ISO date string
    const releaseDate: string = doc.releaseDate;
    expect(releaseDate).toBe("2024-01-15");

    // localized: stored as JSON, surfaced as a per-locale record
    const title: { readonly "en-US": string; readonly "fr-FR": string } = doc.title;
    expect(title["en-US"]).toBe("Hello");
    expect(title["fr-FR"]).toBe("Bonjour");

    // boolean: stored as 0/1, surfaced as a real boolean
    const featured: boolean = doc.featured;
    expect(featured).toBe(true);

    // duration: stored as integer seconds, surfaced as a number
    const readSeconds: number = doc.readSeconds;
    expect(readSeconds).toBe(300);
  });

  it("carries the same shapes through list", async () => {
    const page = await run((client) => client.articles.list({}));
    expect(page.documents).toHaveLength(1);
    const doc = page.documents[0];
    if (doc === undefined) throw new Error("expected a row");
    expect(doc.publishedAt.getTime()).toBe(PUBLISHED_AT);
    expect(doc.releaseDate).toBe("2024-01-15");
    expect(doc.title["fr-FR"]).toBe("Bonjour");
  });
});
