// `voila migrate generate` — derive a table schema from the content config and
// write it out as the next `NNNN_name.sql` migration. Phase 1 emits the *full*
// DDL as a single migration; schema diffing against an existing database lands
// later. Re-running on a config that already has tables produces a fresh
// full-DDL file, which will fail on apply if the tables already exist — the diff
// step is what makes regeneration safe.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import type { NormalizedConfig } from "@voila/content";
import { authTablesSql, type Dialect, deriveSchema } from "@voila/content/sql";
import { generateDDL } from "../ddl/generate-ddl";
import { formatMigrationId, nextMigrationId } from "./loader";

export interface GenerateMigrationOpts {
  /** The content config to derive tables from. */
  readonly config: NormalizedConfig;
  /** Directory the migration file is written to (created if missing). */
  readonly dir: string;
  /** Human-readable migration name; slugified into the filename. */
  readonly name: string;
  /** SQL dialect to render. D1 uses `sqlite`. */
  readonly dialect: Dialect;
  /** Append the Better Auth core-table DDL (`user`/`session`/`account`/`verification`). */
  readonly auth?: boolean;
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "migration"
  );
}

/**
 * Writes the next migration file and returns its full path. The DDL is rendered
 * for `dialect`; the file is named `NNNN_<slug>.sql` where `NNNN` is one past
 * the highest existing id in `dir`. With `opts.auth`, the Better Auth core-table
 * DDL is appended (SQLite only — its `INTEGER`-epoch/`0/1`-boolean shape is what
 * the SQL adapter expects).
 */
export async function generateMigration(opts: GenerateMigrationOpts): Promise<string> {
  if (opts.auth && opts.dialect !== "sqlite") {
    throw new Error(
      `--auth is only supported with --dialect sqlite (got "${opts.dialect}"); the Postgres auth schema lands with the pg client.`,
    );
  }

  await mkdir(opts.dir, { recursive: true });

  const existing = await readdir(opts.dir);
  const id = formatMigrationId(nextMigrationId(existing));
  const filename = `${id}_${slugify(opts.name)}.sql`;
  const path = `${opts.dir}/${filename}`;

  const collectionsDdl = generateDDL(deriveSchema(opts.config), opts.dialect);
  const ddl = opts.auth ? `${collectionsDdl}\n${authTablesSql}` : collectionsDdl;
  await writeFile(path, ddl);

  return path;
}
