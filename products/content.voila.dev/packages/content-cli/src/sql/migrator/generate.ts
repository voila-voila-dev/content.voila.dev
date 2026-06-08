// `voila migrate generate` — derive a table schema from the content config and
// write it out as the next `NNNN_name.sql` migration. M1 emits the *full* DDL as
// a single migration; schema diffing against an existing database lands later
// (see roadmap M4+). Re-running on a config that already has tables produces a
// fresh full-DDL file, which will fail on apply if the tables already exist —
// the diff step is what makes regeneration safe.

import { FileSystem } from "@effect/platform/FileSystem";
import { Effect } from "effect";
import { authTablesSql } from "../../auth/schema";
import type { NormalizedConfig } from "../../config/config";
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
  /**
   * Append the Better Auth core tables (`user`/`session`/`account`/
   * `verification`) so `apply` provisions them alongside the collection schema.
   * Only available for `sqlite`/d1 in M1 — ignored for `postgres` (pg auth DDL
   * lands in M2). Defaults to `false`; the CLI defaults it on.
   */
  readonly includeAuth?: boolean;
}

const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "migration";

/**
 * Writes the next migration file and returns its full path. The DDL is rendered
 * for `dialect`; the file is named `NNNN_<slug>.sql` where `NNNN` is one past
 * the highest existing id in `dir`.
 */
export const generateMigration = (opts: GenerateMigrationOpts) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    yield* fs.makeDirectory(opts.dir, { recursive: true });

    const existing = yield* fs.readDirectory(opts.dir);
    const id = formatMigrationId(nextMigrationId(existing));
    const filename = `${id}_${slugify(opts.name)}.sql`;
    const path = `${opts.dir}/${filename}`;

    const content = generateDDL(deriveSchema(opts.config), opts.dialect);
    // Auth DDL is sqlite-only today; pg auth tables are M2. For sqlite/d1 the
    // four Better Auth tables are appended so one `apply` provisions everything.
    const ddl =
      opts.includeAuth && opts.dialect === "sqlite" ? `${content}\n${authTablesSql}` : content;
    yield* fs.writeFileString(path, ddl);

    return path;
  });
