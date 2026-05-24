import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Content } from "@voila/content";

export interface LoadContentConfigOptions {
  /** Working directory used to resolve a relative config path. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Path to the config file. Defaults to `./content.config.ts`. */
  config?: string;
}

/**
 * Load and resolve a `content.config.ts` file. Bun's loader handles TypeScript
 * directly, so we just dynamic-import the file and read its default export.
 */
export async function loadContentConfig(options: LoadContentConfigOptions = {}): Promise<Content> {
  const cwd = options.cwd ?? process.cwd();
  const path = options.config ?? "./content.config.ts";
  let absPath = resolve(cwd, path);
  // Accept a `.tsx` config (JSX in `defineContent`, e.g. `branding.logo`)
  // when a `.ts` path was given but only the `.tsx` sibling exists.
  if (!existsSync(absPath) && absPath.endsWith(".ts") && existsSync(`${absPath}x`)) {
    absPath = `${absPath}x`;
  }
  if (!existsSync(absPath)) {
    throw new Error(`content config not found: ${absPath}`);
  }
  const mod = (await import(pathToFileURL(absPath).href)) as { default?: Content };
  if (!mod.default) {
    throw new Error(`${absPath} must \`export default defineContent({ ... })\``);
  }
  return mod.default;
}
