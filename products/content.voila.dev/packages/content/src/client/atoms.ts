// `@voila/content/client/atoms` — the per-collection effect-atom factory (M1).
// `makeVoilaAtoms(config, options)` derives reactive read atoms for every
// collection in the config, backed by the typed RPC client (`makeVoilaClient`).
// Each collection exposes `list`/`find`/`findOne` atom families whose values are
// `Result`s of the same typed documents the client returns.
//
// The *shape* of these atoms is the contract vended Head components depend on. In
// M3 the backend swaps from the RPC client to `@effect-atom/atom-livestore` over
// the project LiveStore — with an identical `collections.<slug>.{list,find,findOne}`
// shape — so the vended components never change when the sync engine lands. Keeping
// the surface free of RPC specifics (no `.query`/`.mutation` tags leaking out) is
// what makes that swap invisible.

import { Atom, Result } from "@effect-atom/atom";
import { Context, Data, Effect, Layer, Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import { collectionDocumentSchema } from "../server/document";
import { BadRequest, InternalError, NotFound } from "../server/errors";
import type { VoilaDocFor } from "../server/types";
import { makeVoilaClient } from "./client";
import type { FindOneInput, ListInput, ListPage, VoilaClient, VoilaClientOptions } from "./types";

/**
 * Read atoms for one collection. The factory functions memoize structurally on
 * their input (via `Atom.family` + `Data.struct` keys), so repeated calls with
 * equal inputs return the *same* atom — sharing one in-flight request and one
 * cached `Result`.
 */
export interface CollectionAtoms<Doc> {
  /** Paginated list atom, keyed by list input. */
  readonly list: (
    input?: ListInput,
  ) => Atom.Atom<Result.Result<ListPage<Doc>, BadRequest | InternalError>>;
  /** Find-by-id atom, keyed by id; fails with `NotFound` when absent. */
  readonly find: (id: string) => Atom.Atom<Result.Result<Doc, NotFound | InternalError>>;
  /** Find-by-field atom, keyed by field/value; resolves to `null` when absent. */
  readonly findOne: (
    input: FindOneInput,
  ) => Atom.Atom<Result.Result<Doc | null, BadRequest | InternalError>>;
}

/**
 * The full atom set derived from a config: one `CollectionAtoms` per slug, plus
 * the shared `AtomRuntime` that owns the underlying RPC client. Vended components
 * read only `collections`; `runtime` is exposed for hosts that need to add global
 * layers or seed atoms for SSR. The `runtime` type is RPC-specific and so is the
 * one part that legitimately changes under the M3 LiveStore swap.
 */
export interface VoilaAtoms<C extends NormalizedConfig> {
  readonly runtime: Atom.AtomRuntime<VoilaClient<C>, never>;
  readonly collections: {
    readonly [Slug in keyof C["collections"] & string]: CollectionAtoms<VoilaDocFor<C, Slug>>;
  };
}

// The client nests dynamically by slug at runtime; the precise per-collection
// shape is restored by the `VoilaAtoms<C>` cast on the way out.
type AnyReadMethod = (input?: unknown) => Effect.Effect<unknown, unknown, never>;

// Resolve `client[slug][method]` through the dynamic shape without tripping
// `noUncheckedIndexedAccess` — the group is config-keyed, so these always exist.
const invoke = (
  client: unknown,
  slug: string,
  method: string,
  input: unknown,
): Effect.Effect<unknown, unknown, never> => {
  const collection = (client as Record<string, Record<string, AnyReadMethod>>)[slug] as Record<
    string,
    AnyReadMethod
  >;
  return (collection[method] as AnyReadMethod)(input);
};

// Canonicalize inputs into structural-equality keys so `Atom.family` dedupes by
// value (plain object literals are otherwise compared by reference, leaking a new
// atom per call).
const canonicalList = (input: ListInput): ListInput =>
  Data.struct({
    limit: input.limit,
    cursor: input.cursor,
    orderBy: input.orderBy,
    direction: input.direction,
  });

const canonicalFindOne = (input: FindOneInput): FindOneInput =>
  Data.struct({ field: input.field, value: input.value });

// Deterministic string keys for `Atom.serializable`. Two separate `makeVoilaAtoms`
// instances (a server one that prefetches, the browser one that renders) produce
// the *same* key for the same read, so a server-dehydrated `Registry` hydrates the
// client atom by key — no SSR fetch waterfall. The keys mirror the canonical inputs
// above so equal reads collapse to one entry.
const listKey = (slug: string, input: ListInput): string =>
  `@voila/${slug}/list/${JSON.stringify([
    input.limit ?? null,
    input.cursor ?? null,
    input.orderBy ?? null,
    input.direction ?? null,
  ])}`;

const findKey = (slug: string, id: string): string => `@voila/${slug}/find/${id}`;

const findOneKey = (slug: string, input: FindOneInput): string =>
  `@voila/${slug}/findOne/${input.field}=${JSON.stringify(input.value)}`;

// `call` produces atoms typed loosely as `Result<unknown, unknown>` (the dynamic
// client shape), while `Result.Schema(...)` is precisely typed. `Schema` is
// invariant in its decoded type, so widen the precise schema to the loose atom
// type for `Atom.serializable` — runtime encode/decode still uses the real schema.
const looseResultSchema = (
  schema: Schema.Schema.Any,
): Schema.Schema<Result.Result<unknown, unknown>> =>
  schema as unknown as Schema.Schema<Result.Result<unknown, unknown>>;

/**
 * Build the atom set for a config. The RPC client is created once into the
 * runtime's scoped layer and shared across every atom; the runtime tears it down
 * when the last subscriber unmounts (unless kept alive by the host registry).
 */
export const makeVoilaAtoms = <C extends NormalizedConfig>(
  config: C,
  options: VoilaClientOptions = {},
): VoilaAtoms<C> => {
  const ClientTag = Context.GenericTag<VoilaClient<C>>("@voila/content/client/atoms/VoilaClient");
  const layer = Layer.scoped(ClientTag, makeVoilaClient(config, options));
  const runtime = Atom.runtime(layer);

  const call = (slug: string, method: string, input: unknown) =>
    runtime.atom(Effect.flatMap(ClientTag, (client) => invoke(client, slug, method, input)));

  const collections: Record<string, CollectionAtoms<unknown>> = {};
  for (const [slug, collection] of Object.entries(config.collections)) {
    // The same document/error schemas the RPC procedures use, so the dehydrated
    // wire shape matches what the client decodes. Built once per collection and
    // shared across every member of its atom families.
    const doc = collectionDocumentSchema(collection);
    const listResult = Result.Schema({
      success: Schema.Struct({
        documents: Schema.Array(doc),
        nextCursor: Schema.NullOr(Schema.String),
      }),
      error: Schema.Union(BadRequest, InternalError),
    });
    const findResult = Result.Schema({
      success: doc,
      error: Schema.Union(NotFound, InternalError),
    });
    const findOneResult = Result.Schema({
      success: Schema.NullOr(doc),
      error: Schema.Union(BadRequest, InternalError),
    });

    const listFamily = Atom.family((key: ListInput) =>
      call(slug, "list", key).pipe(
        Atom.serializable({ key: listKey(slug, key), schema: looseResultSchema(listResult) }),
      ),
    );
    const findFamily = Atom.family((id: string) =>
      call(slug, "find", { id }).pipe(
        Atom.serializable({ key: findKey(slug, id), schema: looseResultSchema(findResult) }),
      ),
    );
    const findOneFamily = Atom.family((key: FindOneInput) =>
      call(slug, "findOne", key).pipe(
        Atom.serializable({ key: findOneKey(slug, key), schema: looseResultSchema(findOneResult) }),
      ),
    );
    collections[slug] = {
      list: (input = {}) => listFamily(canonicalList(input)),
      find: (id) => findFamily(id),
      findOne: (input) => findOneFamily(canonicalFindOne(input)),
    } as CollectionAtoms<unknown>;
  }

  return { runtime, collections } as unknown as VoilaAtoms<C>;
};
