// Loads a consumer's `content.config.ts` and hands back the `NormalizedConfig`
// the migration commands derive tables from. The config is a TS module
// default-exporting the result of `defineConfig`; Bun imports `.ts` directly.

import { isAbsolute, resolve } from "node:path";
import type { NormalizedConfig } from "@voila/content";

export class ConfigLoadError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(message);
    this.name = "ConfigLoadError";
    this.path = path;
  }
}

/**
 * Resolve `configPath` against the current working directory, import it, and
 * return its default export as a `NormalizedConfig`. `collections`/`singletons`
 * are defaulted to `{}` so a config that defines only one still derives.
 */
export async function loadConfig(configPath: string): Promise<NormalizedConfig> {
  const abs = isAbsolute(configPath) ? configPath : resolve(process.cwd(), configPath);

  let mod: { default?: unknown };
  try {
    mod = await import(abs);
  } catch (cause) {
    throw new ConfigLoadError(abs, cause instanceof Error ? cause.message : String(cause));
  }

  const config = mod.default as NormalizedConfig | undefined;
  if (config === undefined || typeof config !== "object" || !("collections" in config)) {
    throw new ConfigLoadError(abs, "config has no default export with a `collections` map");
  }

  return config;
}
