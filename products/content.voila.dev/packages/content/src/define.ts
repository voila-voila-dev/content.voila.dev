// @voila/content/define — defineCollection / defineSingleton / defineContent.
//
// Produces literal-typed Collection/Singleton descriptors and composes the
// default service Layers + adapter Layers into a `ManagedRuntime`. The shape
// of `ContentConfig` follows the design doc (docs/pivot/packages/content.md).

import type { Schema } from "effect";
import { Layer, ManagedRuntime } from "effect";
import type { Queue } from "./queue/inline.ts";
import type { DatabaseService } from "./services/index.ts";
import {
  DocumentLive,
  DocumentService,
  HookLive,
  HookService,
  MutationLive,
  MutationService,
  RbacLive,
  RbacService,
} from "./services/index.ts";

// -- Collections / Singletons ------------------------------------------------

/**
 * Field map — each value is an annotated effect/Schema.
 *
 * Uses `Schema.Schema.Any` (the canonical "any schema" type from effect) so
 * concrete `Schema<string>`/`Schema<boolean>` constructors from
 * `@voila/content-schema` assign cleanly without a variance dance.
 */
export type FieldsMap = Readonly<Record<string, Schema.Schema.Any>>;

export interface CollectionDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export interface SingletonDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "singleton";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export type Collection<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = CollectionDef<Slug, Fields>;

export type Singleton<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = SingletonDef<Slug, Fields>;

export const defineCollection = <const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Collection<Slug, Fields> => ({
  kind: "collection",
  slug: def.slug,
  label: def.label,
  fields: def.fields,
});

export const defineSingleton = <const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Singleton<Slug, Fields> => ({
  kind: "singleton",
  slug: def.slug,
  label: def.label,
  fields: def.fields,
});

// -- defineContent -----------------------------------------------------------

export interface Branding {
  readonly name: string;
}

/** Adapter Layers — `database` is required; the rest are optional in M0. */
export interface ContentConfig {
  readonly branding: Branding;
  readonly collections?: ReadonlyArray<Collection>;
  readonly singletons?: ReadonlyArray<Singleton>;
  /** Required: a Layer providing the `Database` Tag. */
  readonly database: Layer.Layer<DatabaseService, unknown, never>;
  /** Optional: a Layer providing the `Queue` Tag (M5). */
  readonly queue?: Layer.Layer<Queue, unknown, never>;
  /** Optional adapter Layers, unused in M0 but reserved for storage/auth/mcp. */
  readonly storage?: Layer.Layer<never, unknown, never>;
  readonly auth?: Layer.Layer<never, unknown, never>;
  readonly mcp?: Layer.Layer<never, unknown, never>;
  /** Power-user override: extra Layers merged into the default graph. */
  readonly layers?: ReadonlyArray<Layer.Layer<never, unknown, never>>;
}

/** Services the umbrella runtime exposes after M0. */
export type ContentServices =
  | DatabaseService
  | DocumentService
  | MutationService
  | RbacService
  | HookService;

/**
 * The value returned by `defineContent`. Spreads `ContentConfig` so vended
 * code that imports the default export reads `config.branding` (not
 * `config.config.branding`), then layers the built `ManagedRuntime` and a
 * `dispose()` convenience on top.
 */
export type ContentRuntime = ContentConfig & {
  readonly runtime: ManagedRuntime.ManagedRuntime<ContentServices, unknown>;
  readonly dispose: () => Promise<void>;
};

/**
 * Compose the default service Layers on top of the user-supplied adapter
 * Layers and wrap the result in a `ManagedRuntime`. Real CRUD, HTTP, and
 * queue behavior land in later milestones; M0 wires the graph.
 */
export const defineContent = (config: ContentConfig): ContentRuntime => {
  // Compose the resolver Layer graph respecting inter-service dependencies.
  // - DocumentLive needs Database.
  // - MutationLive needs DocumentService + Database.
  // `Layer.mergeAll` does NOT feed siblings into each other, so we build the
  // dependency chain explicitly: DocumentLive → MutationLive, then merge
  // independent Layers (RBAC, hooks, Database).
  const documentL = DocumentLive; // needs Database
  const mutationL = MutationLive.pipe(Layer.provide(documentL)); // needs Database (DocumentService satisfied)

  // Merge everything; all still need Database at the bottom.
  const serviceGraph = Layer.mergeAll(documentL, mutationL, RbacLive, HookLive);

  // Provide the user's database Layer, then merge it back in so consumers
  // outside the resolver layer can `yield* Database` directly.
  const baseLayer: Layer.Layer<ContentServices, unknown, never> = Layer.mergeAll(
    config.database,
    serviceGraph.pipe(Layer.provide(config.database)),
  );

  // Apply any user override Layers on top (A′ extension point).
  //
  // `Layer.provideMerge` requires the inner Layer's services to widen into the
  // outer's required services. User overrides are typed as `Layer<never,
  // unknown, never>` (the variance-permissive shape stored on `ContentConfig`),
  // and `Layer.Layer` is invariant on the success-channel type parameter, so
  // TS won't infer the merge automatically — bridge once at this single seam.
  const finalLayer = (config.layers ?? []).reduce<Layer.Layer<ContentServices, unknown, never>>(
    (acc, l) => Layer.provideMerge(acc, l as Layer.Layer<never, unknown, never>),
    baseLayer,
  );

  const runtime = ManagedRuntime.make(finalLayer);

  return {
    ...config,
    runtime,
    dispose: () => runtime.dispose(),
  };
};

export { Database, DatabaseLive } from "./services/index.ts";
// Re-export the default Layer surface so power users can compose their own runtime.
export {
  DocumentLive,
  DocumentService,
  HookLive,
  HookService,
  MutationLive,
  MutationService,
  RbacLive,
  RbacService,
};
