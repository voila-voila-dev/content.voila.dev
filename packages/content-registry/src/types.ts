// The registry manifest types. The registry is a shadcn-style catalog of
// vendable items: real source files copied into a consumer's app (`voila add`),
// where they become the app's own code. An item declares the files it owns, the
// npm packages they need (`dependencies`), and the other registry items it
// builds on (`registryDependencies`). The resolver in `./resolve` walks that
// graph; the files live on disk under `src/items/` and are read by `./files`.

/** What kind of thing an item vends. Mirrors the roadmap's catalog surface. */
export type RegistryItemType = "shell" | "route" | "block" | "field" | "lib";

export interface RegistryFile {
  /**
   * Path of the source file within the registry's `src/items/` directory. It is
   * also the default install destination, relative to the consumer's app root.
   */
  readonly path: string;
  /** Override install destination (relative to the app root). Defaults to `path`. */
  readonly target?: string;
}

export interface RegistryItem {
  /** Unique, kebab-case identifier — the name passed to `voila add`. */
  readonly name: string;
  readonly type: RegistryItemType;
  readonly title: string;
  readonly description: string;
  /** npm packages the files import, as name → semver range. */
  readonly dependencies?: Readonly<Record<string, string>>;
  /** Names of other registry items this one composes. */
  readonly registryDependencies?: ReadonlyArray<string>;
  readonly files: ReadonlyArray<RegistryFile>;
}

export interface Registry {
  readonly items: ReadonlyArray<RegistryItem>;
}

/** The install destination for a file — its `target` override, else its `path`. */
export function fileTarget(file: RegistryFile): string {
  return file.target ?? file.path;
}
