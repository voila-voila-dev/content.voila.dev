// Host-app checks for the registry commands. `voila add` and `voila diff`
// operate on files under `--cwd`; before touching anything we verify the
// directory actually looks like a voila app (a `package.json` and a
// `content.config.ts` at the root) so vended files never land in an arbitrary
// directory silently. Registry targets are authored under `app/` — the
// create-voila layout — so `resolveSrcDirectory` reads the host's vite config
// (TanStack Start's `srcDirectory` option) and `retargetFiles` remaps targets
// for `src/`-shaped apps.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileTarget, type RegistryFile } from "@voila/content-registry";
import { CliError } from "./index";

const HOST_MARKERS = ["package.json", "content.config.ts"];

const VITE_CONFIGS = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"];

/** Throw unless `cwd` is a voila app root (package.json + content.config.ts). */
export function validateHost(cwd: string): void {
  if (!existsSync(cwd)) {
    throw new CliError(`Directory not found: ${cwd}`);
  }
  const missing = HOST_MARKERS.filter((name) => !existsSync(join(cwd, name)));
  if (missing.length > 0) {
    throw new CliError(
      `${cwd} doesn't look like a voila app (missing ${missing.join(" and ")}). ` +
        `Run inside an app created with "bun create voila", or point --cwd at one.`,
    );
  }
}

/**
 * Where the host keeps its source tree. Resolution order: the `srcDirectory`
 * option in the vite config → TanStack Start's `src` default when the plugin
 * is configured without it → an existing `src/routes` directory → `app`.
 */
export function resolveSrcDirectory(cwd: string): string {
  for (const name of VITE_CONFIGS) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    const source = readFileSync(path, "utf8");
    const explicit = source.match(/srcDirectory\s*:\s*["']([^"']+)["']/)?.[1];
    if (explicit !== undefined) return explicit.replace(/^\.\//, "");
    if (source.includes("tanstackStart")) return "src";
  }
  return existsSync(join(cwd, "src", "routes")) ? "src" : "app";
}

/** Remap each file's install target from the authored `app/…` layout to the
 *  host's source directory. Targets outside `app/` are left alone. */
export function retargetFiles(
  files: ReadonlyArray<RegistryFile>,
  srcDirectory: string,
): ReadonlyArray<RegistryFile> {
  if (srcDirectory === "app") return files;
  return files.map((file) => {
    const target = fileTarget(file);
    return target.startsWith("app/")
      ? { ...file, target: `${srcDirectory}/${target.slice("app/".length)}` }
      : file;
  });
}
