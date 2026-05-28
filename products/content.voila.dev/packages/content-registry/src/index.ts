// @voila/content-registry — internal surface consumed by @voila/content-cli.
// Design: products/content.voila.dev/docs/pivot/packages/content-registry.md
// The vended source files live under ./items/** and are treated as data — they
// are excluded from tsc -b and shipped raw in the published tarball.

import { Schema } from "effect";

export const name: "@voila/content-registry" = "@voila/content-registry";

/** A single file vended by a registry item. */
export interface RegistryItemFile {
  /** Path relative to the package root where the source lives. */
  readonly path: string;
  /** Path relative to the consumer's app where the CLI writes the file. */
  readonly target: string;
  /** Optional shadcn-style file type hint (e.g. "registry:file"). */
  readonly type?: string | undefined;
}

/** One catalog entry — what `voila add <name>` resolves and copies. */
export interface RegistryItem {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly files: ReadonlyArray<RegistryItemFile>;
  /** npm packages the CLI installs alongside this item. */
  readonly deps: ReadonlyArray<string>;
  /** Other registry items this item depends on (resolved transitively). */
  readonly registryDeps: ReadonlyArray<string>;
}

/** The shape of `registry.json` at the package root. */
export interface RegistryManifest {
  readonly $schema?: string | undefined;
  readonly name: string;
  readonly homepage?: string | undefined;
  readonly items: ReadonlyArray<RegistryItem>;
}

// `effect/Schema` mirrors of the interfaces above — kept private so the public
// surface is a plain TS shape. The `Schema.Schema<T>` annotation forces TS to
// reconcile the runtime decoder with the interface, so adding a field to one
// without the other fails to compile.
const RegistryItemFileSchema: Schema.Schema<RegistryItemFile> = Schema.Struct({
  path: Schema.String,
  target: Schema.String,
  type: Schema.optional(Schema.String),
});

const RegistryItemSchema: Schema.Schema<RegistryItem> = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  description: Schema.String,
  files: Schema.Array(RegistryItemFileSchema),
  deps: Schema.Array(Schema.String),
  registryDeps: Schema.Array(Schema.String),
});

const RegistryManifestSchema: Schema.Schema<RegistryManifest> = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  name: Schema.String,
  homepage: Schema.optional(Schema.String),
  items: Schema.Array(RegistryItemSchema),
});

/**
 * Decode an arbitrary value (typically the result of `JSON.parse(...)`) into
 * a validated `RegistryManifest`. Throws a `ParseError` on bad input so the
 * cast-free decode path is the obvious choice in every consumer.
 */
export const decodeManifest: (input: unknown) => RegistryManifest =
  Schema.decodeUnknownSync(RegistryManifestSchema);

/**
 * Absolute URL hint the CLI uses to locate `registry.json` at runtime.
 * Resolves the JSON sibling of this module regardless of where the package
 * is installed.
 */
export const registryManifestUrl: URL = new URL("../registry.json", import.meta.url);

/**
 * Walk `registryDeps` transitively for `name`, returning a deduplicated
 * topological order in which the requested item appears last.
 *
 * Throws if `name` is not in the manifest or if a dependency is missing.
 * Cycles are tolerated via `seen` short-circuit (a cycle still yields a
 * valid topological order over the acyclic subset).
 */
export const resolveItems = (
  manifest: RegistryManifest,
  name: string,
  seen: Set<string> = new Set(),
): ReadonlyArray<RegistryItem> => {
  if (seen.has(name)) return [];
  seen.add(name);

  const item = manifest.items.find((i) => i.name === name);
  if (!item) {
    throw new Error(`Unknown registry item: ${name}`);
  }

  const out: Array<RegistryItem> = [];
  for (const dep of item.registryDeps) {
    for (const resolved of resolveItems(manifest, dep, seen)) {
      out.push(resolved);
    }
  }
  out.push(item);
  return out;
};
