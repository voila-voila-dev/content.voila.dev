/**
 * `voila seed admin` — insert (or upsert) a row into the better-auth `user`
 * table so the first magic-link request can sign the address in directly.
 * No password is set; the magic-link plugin owns credential delivery.
 *
 * Dispatch mirrors `migrate apply`:
 *   --target sqlite      → bun:sqlite, requires --db
 *   --target d1-local    → `wrangler d1 execute … --local`
 *   --target d1-remote   → `wrangler d1 execute … --remote`
 *
 * The shell-out form is one CLI tool calling another instead of bundling
 * `@cloudflare/workers-types`'s D1 adapter into the CLI process, which keeps
 * the dependency footprint identical to `voila migrate`.
 */

import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export interface SeedAdminOptions {
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Email address — required. Used as the unique sign-in identifier. */
  email: string;
  /** Optional display name. Falls back to the local-part of the email. */
  name?: string;
  /** Same target enum as `migrate apply`. */
  target?: "sqlite" | "d1-local" | "d1-remote";
  /** SQLite URL (`":memory:"`, `"file:./voila.db"`, or a bare path). Required for `sqlite`. */
  db?: string;
  /** Wrangler D1 binding name. Required for `d1-local` / `d1-remote`. */
  binding?: string;
  /** Wrangler config path. Optional. */
  wranglerConfig?: string;
  /** Override the wrangler binary. */
  wranglerBin?: string;
  /**
   * Override the timestamp source. Tests pin this so the inserted row is
   * deterministic; production callers leave it undefined to use `Date.now()`.
   */
  now?: () => number;
  /**
   * Override the id generator. Tests pin this; production callers leave it
   * undefined so we mint a fresh ULID-ish identifier per insert.
   */
  idGenerator?: () => string;
}

export interface SeedAdminResult {
  target: "sqlite" | "d1-local" | "d1-remote";
  id: string;
  email: string;
  /** `"inserted"` for a brand-new row, `"updated"` when the email already existed. */
  action: "inserted" | "updated";
}

export async function seedAdmin(options: SeedAdminOptions): Promise<SeedAdminResult> {
  const target = options.target ?? "sqlite";
  if (!options.email) {
    throw new Error('seed admin: --email is required (e.g. "you@example.com")');
  }
  const email = normalizeEmail(options.email);
  const now = (options.now ?? Date.now)();
  const id = (options.idGenerator ?? defaultIdGenerator)();
  const name = options.name ?? email.split("@")[0] ?? email;

  if (target === "sqlite") {
    if (!options.db) {
      throw new Error('seed admin: --db is required when --target is "sqlite"');
    }
    const action = upsertSqlite({
      cwd: options.cwd ?? process.cwd(),
      url: options.db,
      id,
      email,
      name,
      now,
    });
    return { target, id, email, action };
  }

  if (!options.binding) {
    throw new Error(`seed admin: --binding is required when --target is "${target}"`);
  }
  const action = upsertViaWrangler({
    cwd: options.cwd ?? process.cwd(),
    target,
    binding: options.binding,
    wranglerConfig: options.wranglerConfig,
    wranglerBin: options.wranglerBin ?? "wrangler",
    id,
    email,
    name,
    now,
  });
  return { target, id, email, action };
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function defaultIdGenerator(): string {
  // Better Auth ids are opaque strings; a URL-safe random suffices. We avoid
  // pulling in ulid/uuid as a runtime dep just for the seed path.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveSqliteUrl(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}

function upsertSqlite(args: {
  cwd: string;
  url: string;
  id: string;
  email: string;
  name: string;
  now: number;
}): "inserted" | "updated" {
  const filename = resolveSqliteUrl(args.url);
  const dbPath = filename === ":memory:" ? ":memory:" : resolve(args.cwd, filename);
  const db = new Database(dbPath);
  try {
    const existing = db
      .query<{ id: string }, [string]>('SELECT "id" FROM "user" WHERE "email" = ?')
      .get(args.email);
    if (existing) {
      db.run('UPDATE "user" SET "name" = ?, "emailVerified" = 1, "updatedAt" = ? WHERE "id" = ?', [
        args.name,
        args.now,
        existing.id,
      ]);
      return "updated";
    }
    db.run(
      'INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") VALUES (?, ?, ?, 1, ?, ?)',
      [args.id, args.name, args.email, args.now, args.now],
    );
    return "inserted";
  } finally {
    db.close();
  }
}

function upsertViaWrangler(args: {
  cwd: string;
  target: "d1-local" | "d1-remote";
  binding: string;
  wranglerConfig: string | undefined;
  wranglerBin: string;
  id: string;
  email: string;
  name: string;
  now: number;
}): "inserted" | "updated" {
  // D1 has no `INSERT … ON CONFLICT DO UPDATE RETURNING action`; we just emit
  // an UPSERT and report `inserted` because the CLI has no read-after-write
  // round trip cheap enough to determine the precise action via wrangler.
  const sql = buildUpsertSql({
    id: args.id,
    email: args.email,
    name: args.name,
    now: args.now,
  });
  const flags = [
    "d1",
    "execute",
    args.binding,
    args.target === "d1-remote" ? "--remote" : "--local",
    "--command",
    sql,
  ];
  if (args.wranglerConfig) flags.push("--config", args.wranglerConfig);
  const result = spawnSync(args.wranglerBin, flags, { cwd: args.cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${args.wranglerBin} ${flags.join(" ")} exited with status ${result.status}`);
  }
  return "inserted";
}

/**
 * Build a single-statement SQLite UPSERT. Email is the conflict target
 * because better-auth's schema marks it `UNIQUE`. String values are
 * escaped by doubling single quotes — adequate for D1's `--command` since
 * we don't allow newlines or shell metachars from the caller into the SQL
 * payload itself.
 */
export function buildUpsertSql(args: {
  id: string;
  email: string;
  name: string;
  now: number;
}): string {
  const id = sqlString(args.id);
  const email = sqlString(args.email);
  const name = sqlString(args.name);
  return (
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") ` +
    `VALUES (${id}, ${name}, ${email}, 1, ${args.now}, ${args.now}) ` +
    `ON CONFLICT("email") DO UPDATE SET "name" = ${name}, "emailVerified" = 1, "updatedAt" = ${args.now};`
  );
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
