// The I/O-free composition root shared by every deployment target. Given a
// `SqlDriver` (D1 on Workers, node:sqlite in dev) and a signing secret, it wires
// the runtime `Database`, the Better Auth bridge, the optional media layer, and
// the REST handler — exactly the bag the demo's `app/lib/server.ts` built by
// hand, now built once in the framework. Construction performs no I/O (it only
// *wraps* the driver/storage handles), so it is safe to call at module scope on
// Cloudflare Workers, where binding methods may only run inside a request.

import type { NormalizedConfig } from "@voila/content";
import {
  consoleMailer,
  firstUserAccess,
  type Mailer,
  makeBetterAuth,
} from "@voila/content/better-auth";
import {
  type AccessControl,
  type Authenticator,
  createRestHandler,
  type Database,
  makeDatabase,
  makeMediaStore,
  makeViewStore,
  type SqlDriver,
  type Storage,
} from "@voila/content/server";

/** The auth bridge shape the API handler needs (a subset of Better Auth's). */
export interface AdminAuthBridge {
  readonly authenticator: Authenticator;
  readonly handler: (request: Request) => Promise<Response>;
  readonly basePath: string;
}

export interface AdminRuntimeOptions {
  /** The SQL driver. `makeD1Driver(env.DB)` on Workers; node/bun sqlite in dev. */
  readonly driver: SqlDriver;
  /** Signs sessions, magic-link tokens, and the CSRF token. From the environment. */
  readonly secret: string;
  /** Where the REST + auth routes mount. Defaults to `/admin/api`. */
  readonly basePath?: string;
  /** Media bytes backend (`makeR2Storage(env.BUCKET)`, fs, s3, memory). Omit to
   *  disable the media routes. */
  readonly storage?: Storage;
  /** Magic-link delivery. Defaults to the console mailer (links print to logs). */
  readonly mailer?: Mailer;
  /** Pinned deployment origin (e.g. `https://admin.acme.com`). Enables Secure
   *  cookies + absolute magic-link URLs. Unset in dev → origin inferred per request. */
  readonly baseUrl?: string;
  /** Session lifetime, e.g. `"7d"`. Passed through to Better Auth. */
  readonly sessionTtl?: string;
  /** Replace the default Better Auth authenticator (e.g. a custom IdP bridge). */
  readonly authenticator?: Authenticator;
  /** Replace the default first-user-wins access control. */
  readonly access?: AccessControl;
}

export interface AdminRuntime {
  readonly database: Database;
  readonly auth: AdminAuthBridge;
  /** The REST dispatcher: `(request) => Response | null` (null = not our route). */
  readonly restHandler: (request: Request) => Promise<Response | null>;
  /** The signing secret, re-exported so the API handler mints CSRF tokens. */
  readonly authSecret: string;
  /** The base path the routes mount under. */
  readonly basePath: string;
}

const DEFAULT_BASE_PATH = "/api";

/**
 * Compose the admin's server runtime from a driver + secret. The returned bag
 * is consumed by {@link import("./api-handler").createApiHandler} (the
 * `/admin/api` mount) and by server functions that read the database directly
 * (dashboard counts, the session guard).
 */
export function createAdminRuntime(
  config: NormalizedConfig,
  options: AdminRuntimeOptions,
): AdminRuntime {
  const { driver, secret } = options;
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;
  // Auth routes always nest under `${basePath}/auth`, so a custom basePath keeps
  // the auth mount in sync with the REST mount (Better Auth otherwise defaults
  // to the literal `/admin/api/auth`).
  const authBasePath = `${basePath}/auth`;

  const database = makeDatabase(config, driver);

  const auth: AdminAuthBridge = options.authenticator
    ? {
        authenticator: options.authenticator,
        // A custom authenticator owns its own routes (if any); the framework
        // mounts nothing under the auth sub-path, so a stray hit just 404s.
        handler: async () => new Response("Not found", { status: 404 }),
        basePath: authBasePath,
      }
    : makeBetterAuth({
        secret,
        driver,
        mailer: options.mailer ?? consoleMailer(),
        baseUrl: options.baseUrl,
        sessionTtl: options.sessionTtl,
        basePath: authBasePath,
      });

  const media =
    options.storage === undefined
      ? undefined
      : { storage: options.storage, store: makeMediaStore(driver) };

  // Saved views are always available in the admin (auth is always wired here, so
  // every `_views` request has an owner from the resolved principal).
  const views = { store: makeViewStore(driver) };

  const restHandler = createRestHandler(
    { config, database, media, views },
    {
      basePath,
      auth: auth.authenticator,
      csrf: { secret },
      access: options.access ?? firstUserAccess(driver),
    },
  );

  return { database, auth, restHandler, authSecret: secret, basePath };
}
