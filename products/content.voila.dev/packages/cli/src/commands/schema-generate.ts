import { resolve } from "node:path";
import type { DatabaseDialect } from "@voila/content-database";
import { resolveBridgePath, writeDrizzleBridge } from "../codegen.ts";
import { loadContentConfig } from "../load-config.ts";

export interface SchemaGenerateOptions {
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Path to the config file, relative to `cwd`. Defaults to `./content.config.ts`. */
  config?: string;
  /** Override the bridge schema file path (relative to `cwd`). */
  bridge?: string;
  /** SQL dialect baked into the bridge. `"sqlite"` covers D1 too. */
  dialect?: DatabaseDialect;
}

export interface SchemaGenerateResult {
  /** Absolute path of the bridge schema file. */
  bridge: string;
  /** Absolute path of the source config that was loaded. */
  config: string;
  /** Slugs the bridge re-exports. */
  collections: string[];
  /** Dialect baked into the bridge. */
  dialect: DatabaseDialect;
}

/**
 * Generate the Drizzle bridge schema (`drizzle/schema.gen.ts`) from a
 * `content.config.ts`.
 *
 * The bridge is a thin re-exporter: it imports the user's config, builds
 * runtime Drizzle tables via `schemaToTables`, and exports each table by
 * slug. Both `drizzle-kit` (for `migrate generate`) and user code (for
 * runtime queries) consume the same file.
 *
 * Run this directly if you want to:
 *   - refresh the bridge without producing a SQL migration
 *   - use the bridge with your own `drizzle.config.ts` (e.g. for
 *     `drizzle-kit studio` or `drizzle-kit push`)
 *   - import the typed tables in app code
 *
 * `voila migrate generate` calls this function internally — splitting the
 * commands just lets you choose which half you want to run.
 */
export async function schemaGenerate(
  options: SchemaGenerateOptions = {},
): Promise<SchemaGenerateResult> {
  const cwd = options.cwd ?? process.cwd();
  const dialect = options.dialect ?? "sqlite";
  const content = await loadContentConfig({ cwd, config: options.config });
  const bridge = resolveBridgePath(cwd, options.bridge);
  const configAbsPath = resolve(cwd, options.config ?? "./content.config.ts");

  writeDrizzleBridge({
    cwd,
    configAbsPath,
    bridgeAbsPath: bridge,
    content,
    dialect,
  });

  const collections = [
    ...Object.values(content.collections).map((c) => c.slug),
    ...Object.values(content.singletons).map((s) => s.slug),
  ];

  return { bridge, config: configAbsPath, collections, dialect };
}
