import { handle } from "./handler.ts";
import type {
  Collection,
  CollectionDef,
  Content,
  ContentConfig,
  FieldsRecord,
  ResolvedContentConfig,
  ResolvedMount,
  Singleton,
  SingletonDef,
} from "./types.ts";

const DEFAULT_MOUNT: ResolvedMount = {
  admin: "/admin",
  api: "/admin/api",
  mcp: "/admin/mcp",
};

export function defineCollection<Fields extends FieldsRecord>(
  def: CollectionDef<Fields>,
): Collection<Fields> {
  return { ...def, kind: "collection" };
}

export function defineSingleton<Fields extends FieldsRecord>(
  def: SingletonDef<Fields>,
): Singleton<Fields> {
  return { ...def, kind: "singleton" };
}

export function defineContent(config: ContentConfig = {}): Content {
  const resolved = resolveConfig(config);
  return {
    ...resolved,
    handle: (request: Request) => handle(request, resolved),
  };
}

export function resolveConfig(config: ContentConfig): ResolvedContentConfig {
  return {
    branding: config.branding ?? {},
    mount: resolveMount(config.mount),
    collections: Object.freeze([...(config.collections ?? [])]),
    singletons: Object.freeze([...(config.singletons ?? [])]),
  };
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
