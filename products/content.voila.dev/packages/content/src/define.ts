import type {
  AnyCollection,
  AnySingleton,
  Collection,
  CollectionDef,
  Content,
  ContentConfig,
  FieldsRecord,
  ResolvedMount,
  Singleton,
  SingletonDef,
  SlugMap,
} from "./types.ts";

const DEFAULT_MOUNT: ResolvedMount = {
  admin: "/admin",
  api: "/admin/api",
  mcp: "/admin/mcp",
};

/**
 * `const Slug` preserves the literal type of the passed-in slug so
 * downstream `Content<{ posts: Collection<"posts", …> }>` keying works.
 */
export function defineCollection<const Slug extends string, Fields extends FieldsRecord>(
  def: CollectionDef<Slug, Fields>,
): Collection<Slug, Fields> {
  return { ...def, kind: "collection" };
}

export function defineSingleton<const Slug extends string, Fields extends FieldsRecord>(
  def: SingletonDef<Slug, Fields>,
): Singleton<Slug, Fields> {
  return { ...def, kind: "singleton" };
}

/**
 * Resolve a user content config into a `Content` whose `collections` and
 * `singletons` are records keyed by literal slug. The `const` type params
 * make TypeScript infer the input arrays as tuples, so the per-element
 * `Collection<"posts", …>` literal types survive into `SlugMap`.
 *
 * Runtime storage is also a record (built once at resolution time); iterate
 * with `Object.values(content.collections)` if you need ordered traversal.
 */
export function defineContent<
  const C extends readonly AnyCollection[] = readonly [],
  const S extends readonly AnySingleton[] = readonly [],
>(
  config: ContentConfig<C, S> = {} as ContentConfig<C, S>,
): Content<SlugMap<C[number]>, SlugMap<S[number]>> {
  const collections = Object.freeze(toMap(config.collections ?? [])) as SlugMap<C[number]>;
  const singletons = Object.freeze(toMap(config.singletons ?? [])) as SlugMap<S[number]>;
  return {
    branding: config.branding ?? {},
    mount: resolveMount(config.mount),
    collections,
    singletons,
  };
}

function toMap<T extends { slug: string }>(items: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.slug]) throw new Error(`defineContent: duplicate slug "${item.slug}"`);
    out[item.slug] = item;
  }
  return out;
}

function resolveMount(mount: ContentConfig["mount"]): ResolvedMount {
  return {
    admin: normalize(mount?.admin ?? DEFAULT_MOUNT.admin),
    api: normalize(mount?.api ?? DEFAULT_MOUNT.api),
    mcp: normalize(mount?.mcp ?? DEFAULT_MOUNT.mcp),
  };
}

function normalize(path: string): string {
  if (!path.startsWith("/")) throw new Error(`mount path must start with "/": ${path}`);
  if (path === "/") return path;
  return path.endsWith("/") ? path.slice(0, -1) : path;
}
