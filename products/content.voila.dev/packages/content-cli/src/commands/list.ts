// `voila list` — print the registry catalog (name + description).
//
// M0 scope per docs/pivot/packages/content-cli.md §"Registry commands".
// Reads `registry.json` from `@voila/content-registry` at runtime via the
// `registryManifestUrl` URL the package exports.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "@effect/cli";
import {
  decodeManifest,
  type RegistryManifest,
  registryManifestUrl,
} from "@voila/content-registry";
import { Effect } from "effect";

/**
 * Load `registry.json` synchronously from the URL exported by
 * `@voila/content-registry` and decode it through the registry's
 * `effect/Schema` (no unchecked cast). Sync is fine here — it's a single
 * small JSON file colocated with the package and read once per CLI
 * invocation.
 */
export const loadManifest = (): RegistryManifest =>
  decodeManifest(JSON.parse(readFileSync(fileURLToPath(registryManifestUrl), "utf8")));

/**
 * The `voila list` Effect. Prints one line per registry item:
 * `<name>  <description>`. Returns `void`; failures bubble up as defects
 * (we don't expect any in normal operation — the manifest is package data).
 */
export const listProgram: Effect.Effect<void> = Effect.sync(() => {
  const manifest = loadManifest();
  for (const item of manifest.items) {
    // Two-space separator; no padding (item count is small in M0).
    console.log(`${item.name}  ${item.description}`);
  }
});

/**
 * `voila list` command descriptor.
 */
export const listCommand: Command.Command<
  "list",
  never,
  never,
  Record<string, never>
> = Command.make("list", {}, () => listProgram).pipe(
  Command.withDescription("List available registry items"),
);
