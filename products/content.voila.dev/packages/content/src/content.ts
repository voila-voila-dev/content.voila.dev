// `defineContent` — the umbrella. It takes the content config plus the runtime
// seams (the `SqlClient` database layer and, optionally, an `auth` block) and
// composes the engine's default `Layer` graph: the `Database` service over the
// given connection, and — when `auth` is set — `BetterAuthLive` wired to a
// mailer resolved from `auth` + `env`, sharing that same connection. The result
// is consumed by `makeHandler` (`@voila/content/server`), which mounts the RPC
// app with session enforcement when auth is present.
//
// `database` is the `SqlClient` seam (e.g. `SqliteLive`/`D1Live`), not a resolved
// `Database` — passing the connection layer lets the engine build *both* the
// `Database` service and the `Auth` tables on one shared connection (the mount's
// single `Layer.build` memoizes it).

import type { SqlClient } from "@effect/sql/SqlClient";
import { Layer } from "effect";
import type { Auth } from "./auth/auth";
import { BetterAuthLive } from "./auth/better-auth";
import { resolveMailerLayer } from "./auth/mailers/resolve";
import { type AuthConfig, type MailerEnv, resolveAuthConfig } from "./auth/types";
import {
  type CollectionMap,
  type Config,
  defineConfig,
  type NormalizedConfig,
  type SingletonMap,
} from "./config/config";
import type { Locale } from "./config/schema/fields/_locale";
import { type Database, makeDatabaseLayer } from "./sql/database";

export interface ContentDefinition<
  Locales extends ReadonlyArray<Locale>,
  Collections extends CollectionMap,
  Singletons extends SingletonMap,
  DE,
> extends Config<Locales, Collections, Singletons> {
  /** The `SqlClient` connection layer (`SqliteLive`, `D1Live`, …). */
  readonly database: Layer.Layer<SqlClient, DE, never>;
  /** Optional auth block. When present, `BetterAuthLive` is wired automatically. */
  readonly auth?: AuthConfig;
  /** Secret signing sessions + magic-link tokens. Required when `auth` is set. */
  readonly secret?: string;
  /** Env source the mailer resolver inspects (`process.env` / worker `env`). */
  readonly env?: MailerEnv;
}

export interface Content<
  Locales extends ReadonlyArray<Locale> = ReadonlyArray<Locale>,
  Collections extends CollectionMap = CollectionMap,
  Singletons extends SingletonMap = SingletonMap,
  DE = unknown,
> {
  /** The normalized config (branding, collections, singletons, i18n). */
  readonly config: NormalizedConfig<Locales, Collections, Singletons>;
  /** The resolved `Database` layer over the given connection. */
  readonly database: Layer.Layer<Database, DE, never>;
  /** The resolved `Auth` layer — present only when `auth` was configured. */
  readonly auth?: Layer.Layer<Auth, DE, never>;
}

/**
 * Compose a content config into its runtime `Layer` graph. The `database`
 * connection is shared between the `Database` service and (when configured) the
 * Better Auth tables. Throws if `auth` is set without a `secret`.
 */
export const defineContent = <
  const Locales extends ReadonlyArray<Locale>,
  // biome-ignore lint/complexity/noBannedTypes: empty-object default lets configs omit collections.
  const Collections extends CollectionMap = {},
  // biome-ignore lint/complexity/noBannedTypes: empty-object default lets configs omit singletons.
  const Singletons extends SingletonMap = {},
  DE = never,
>(
  definition: ContentDefinition<Locales, Collections, Singletons, DE>,
): Content<Locales, Collections, Singletons, DE> => {
  const config = defineConfig<Locales, Collections, Singletons>({
    branding: definition.branding,
    i18n: definition.i18n,
    collections: definition.collections,
    singletons: definition.singletons,
  });

  const database = makeDatabaseLayer(config).pipe(Layer.provide(definition.database));

  let auth: Layer.Layer<Auth, DE, never> | undefined;
  if (definition.auth !== undefined) {
    if (!definition.secret) {
      throw new Error("defineContent: `secret` is required when `auth` is configured.");
    }
    const resolved = resolveAuthConfig(definition.auth);
    auth = BetterAuthLive(definition.auth, { secret: definition.secret }).pipe(
      Layer.provide(resolveMailerLayer(resolved, definition.env)),
      Layer.provide(definition.database),
    );
  }

  return { config, database, auth };
};
