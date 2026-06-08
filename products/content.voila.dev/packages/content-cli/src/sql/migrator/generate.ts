// `voila migrate generate` — derive a table schema from the content config and
// write it out as the next `NNNN_name.sql` migration. Phase 1 emits the *full*
// DDL as a single migration; schema diffing against an existing database lands
// later. Re-running on a config that already has tables produces a fresh
// full-DDL file, which will fail on apply if the tables already exist — the diff
// step is what makes regeneration safe.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import type { NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../ddl/derive-schema";
import { generateDDL } from "../ddl/generate-ddl";
import type { Dialect } from "../ddl/types";
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
 * the highest existing id in `dir`.
 */
export async function generateMigration(opts: GenerateMigrationOpts): Promise<string> {
  await mkdir(opts.dir, { recursive: true });

  const existing = await readdir(opts.dir);
  const id = formatMigrationId(nextMigrationId(existing));
  const filename = `${id}_${slugify(opts.name)}.sql`;
  const path = `${opts.dir}/${filename}`;

  const ddl = generateDDL(deriveSchema(opts.config), opts.dialect);
  await writeFile(path, ddl);

  return path;
}
