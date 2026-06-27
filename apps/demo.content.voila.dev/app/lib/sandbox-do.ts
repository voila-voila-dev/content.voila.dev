// SandboxDO — one Durable Object per signed-in demo user, holding that user's
// entire content set in its own embedded SQLite. The public demo is a shared
// playground, so isolating every visitor keeps them from seeing or clobbering
// each other's data, and a sliding 1-hour alarm wipes a sandbox an hour after
// its owner's last request so it always re-opens fresh.
//
// Auth stays in the Worker's shared D1 (Better Auth). The Worker validates the
// session, then forwards content requests here with a trusted `x-voila-principal`
// header (DOs aren't publicly routable, so the header can't be spoofed by a
// client). The DO builds the content runtime — Database, media, saved views, the
// REST handler — directly from `@voila/content/server`, deriving its schema from
// the config at runtime so it's always in sync (and never hits the D1 migration
// drift the hand-authored migrations are prone to).

import { DurableObject } from "cloudflare:workers";
import {
  type AccessControl,
  type Authenticator,
  type CsrfOptions,
  coerceBindings,
  createRestHandler,
  type Database,
  makeDatabase,
  makeMediaStore,
  makeR2Storage,
  makeViewStore,
  type Principal,
  type R2BucketLike,
  type SqlDriver,
  type SqlValue,
} from "@voila/content/server";
import { deriveSchema } from "@voila/content/sql";
import { generateDDL } from "@voila/content-cli/sql/ddl";
import config from "../../content.config";
import { seedSandbox } from "./sandbox-seed";

/** Sliding expiry: wipe a sandbox 1h after its owner's last request. */
const TTL_MS = 60 * 60 * 1000;

/** R2 supports listing for cleanup; `R2BucketLike` only declares put/get/delete. */
interface SandboxBucket extends R2BucketLike {
  list(opts: {
    prefix: string;
    cursor?: string;
  }): Promise<{ objects: ReadonlyArray<{ key: string }>; truncated: boolean; cursor?: string }>;
}

interface SandboxEnv {
  /** Signs sessions/CSRF; the DO re-verifies CSRF on forwarded writes. */
  readonly VOILA_AUTH_SECRET: string;
  /** Shared media bucket; this DO prefixes every key with its own id. */
  readonly BUCKET?: SandboxBucket;
}

interface SandboxRuntime {
  readonly database: Database;
  readonly handle: (request: Request) => Promise<Response>;
}

// Split an engine-generated DDL script into single statements. The generated SQL
// has no triggers/FTS or string literals containing `;`, so a plain split is safe.
function statements(ddl: string): string[] {
  return ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export class SandboxDO extends DurableObject<SandboxEnv> {
  private runtime?: Promise<SandboxRuntime>;

  /** A `SqlDriver` over the DO's embedded SQLite (mirrors `makeD1Driver`). */
  private driver(): SqlDriver {
    const sql = this.ctx.storage.sql;
    return {
      async all(query: string, params: ReadonlyArray<SqlValue> = []) {
        return sql.exec(query, ...coerceBindings(params)).toArray() as Record<string, unknown>[];
      },
      async run(query: string, params: ReadonlyArray<SqlValue> = []) {
        sql.exec(query, ...coerceBindings(params));
      },
    };
  }

  /** Stable byte-key prefix isolating this sandbox's media in the shared bucket. */
  private mediaPrefix(): string {
    return `sandbox/${this.ctx.id.toString()}/`;
  }

  /** Wrap the shared bucket so every key is prefixed to this sandbox. */
  private prefixedBucket(bucket: SandboxBucket): R2BucketLike {
    const prefix = this.mediaPrefix();
    return {
      put: (key, value, options) => bucket.put(prefix + key, value, options),
      get: (key) => bucket.get(prefix + key),
      delete: (key) => bucket.delete(prefix + key),
    };
  }

  /** The Worker validated the session and injected the principal; trust it. */
  private authenticator(): Authenticator {
    return {
      async authenticate(request: Request): Promise<Principal | null> {
        const raw = request.headers.get("x-voila-principal");
        if (!raw) return null;
        try {
          return JSON.parse(raw) as Principal;
        } catch {
          return null;
        }
      },
    };
  }

  /** Build the content runtime once per DO wake; create + seed schema on a fresh DO. */
  private ensureReady(): Promise<SandboxRuntime> {
    this.runtime ??= this.ctx.blockConcurrencyWhile(async () => {
      const driver = this.driver();
      const fresh =
        this.ctx.storage.sql
          .exec("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
          .toArray().length === 0;
      if (fresh) {
        for (const stmt of statements(generateDDL(deriveSchema(config), "sqlite"))) {
          this.ctx.storage.sql.exec(stmt);
        }
      }

      const database = makeDatabase(config, driver);
      const bucket = this.env.BUCKET;
      const media = bucket
        ? { storage: makeR2Storage(this.prefixedBucket(bucket)), store: makeMediaStore(driver) }
        : undefined;
      const views = { store: makeViewStore(driver) };
      const csrf: CsrfOptions = { secret: this.env.VOILA_AUTH_SECRET };
      const allowAll: AccessControl = () => true;
      const restHandler = createRestHandler(
        { config, database, media, views },
        { basePath: "/api", auth: this.authenticator(), csrf, access: allowAll },
      );
      const handle = async (request: Request): Promise<Response> =>
        (await restHandler(request)) ?? new Response("Not found", { status: 404 });

      if (fresh) await seedSandbox(database);
      return { database, handle };
    });
    return this.runtime;
  }

  async fetch(request: Request): Promise<Response> {
    // Sliding TTL: every request pushes the wipe alarm forward, so an active user
    // is never interrupted and an idle sandbox is reclaimed an hour later.
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
    const { database, handle } = await this.ensureReady();

    // Internal route the dashboard's SSR counts call (content lives here, not D1).
    if (new URL(request.url).pathname === "/__counts") {
      const slugs = Object.keys(config.collections);
      const entries = await Promise.all(
        slugs.map(async (slug): Promise<[string, number] | null> => {
          try {
            const { total } = await database.list(slug, { limit: 1, count: true, status: "any" });
            return total === undefined ? null : [slug, total];
          } catch {
            return null;
          }
        }),
      );
      return Response.json(Object.fromEntries(entries.filter((e) => e !== null)));
    }

    return handle(request);
  }

  /** Sliding-TTL expiry fired: wipe bytes + SQLite so the next use re-seeds fresh. */
  async alarm(): Promise<void> {
    const bucket = this.env.BUCKET;
    if (bucket) {
      const prefix = this.mediaPrefix();
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, cursor });
        await Promise.all(page.objects.map((o) => bucket.delete(o.key)));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
    await this.ctx.storage.deleteAll();
    this.runtime = undefined;
  }
}
