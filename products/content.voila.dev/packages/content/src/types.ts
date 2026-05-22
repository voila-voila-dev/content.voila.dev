import type { AnyFieldDef } from "@voila/content-schema";

export type Branding = {
  /** Display name shown in the sidebar header, browser tab, and emails. */
  name?: string;
  /** Light-mode logo URL. */
  logo?: string;
  /** Dark-mode logo URL. */
  logoDark?: string;
  /** Favicon URL. */
  favicon?: string;
  /** CSS color string used as `--voila-color-accent`. */
  accent?: string;
};

export type Mount = {
  /** Where the admin SPA is mounted. Default: `/admin`. */
  admin?: string;
  /** Where the REST/RPC API is mounted. Default: `/admin/api`. */
  api?: string;
  /** Where the MCP server is mounted. Default: `/admin/mcp`. */
  mcp?: string;
};

export type ResolvedMount = Required<Mount>;

export type FieldsRecord = Record<string, AnyFieldDef>;

export type CollectionDef<Fields extends FieldsRecord = FieldsRecord> = {
  slug: string;
  label?: string;
  icon?: string;
  description?: string;
  fields: Fields;
};

export type SingletonDef<Fields extends FieldsRecord = FieldsRecord> = {
  slug: string;
  label?: string;
  icon?: string;
  description?: string;
  fields: Fields;
};

export type Collection<Fields extends FieldsRecord = FieldsRecord> = CollectionDef<Fields> & {
  readonly kind: "collection";
};

export type Singleton<Fields extends FieldsRecord = FieldsRecord> = SingletonDef<Fields> & {
  readonly kind: "singleton";
};

// biome-ignore lint/suspicious/noExplicitAny: variance escape hatch — registries operate on any field shape.
export type AnyCollection = Collection<any>;
// biome-ignore lint/suspicious/noExplicitAny: variance escape hatch — registries operate on any field shape.
export type AnySingleton = Singleton<any>;

export type ContentConfig = {
  branding?: Branding;
  mount?: Mount;
  collections?: AnyCollection[];
  singletons?: AnySingleton[];
};

export type ResolvedContentConfig = {
  branding: Branding;
  mount: ResolvedMount;
  collections: readonly AnyCollection[];
  singletons: readonly AnySingleton[];
};

export type Content = ResolvedContentConfig & {
  handle(request: Request): Promise<Response>;
};
