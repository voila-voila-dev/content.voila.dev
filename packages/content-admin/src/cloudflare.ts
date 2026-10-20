// `@voila/content-admin/cloudflare` — the one-Worker-per-site runtime factory. Reads the
// site's bindings and secrets from the Worker `env` and builds the admin runtime
// (D1 database + R2 media + Better Auth + REST handler).
//
// Module-scope safety: `makeD1Driver(env.DB)` and `makeR2Storage(env.BUCKET)`
// only *wrap* the binding handles — no I/O runs until a request invokes a method
// — so calling this at module scope is allowed on Workers, where binding I/O
// outside a request context throws.

import { env as workerEnv } from "cloudflare:workers";
import type { NormalizedConfig } from "@voila/content";
import {
  cloudflareMailer,
  type Mailer,
  resendMailer,
  type SendEmailBindingLike,
} from "@voila/content/better-auth";
import {
  type D1Binding,
  makeD1Driver,
  makeR2Storage,
  type R2BucketLike,
} from "@voila/content/server";
import { type AdminRuntime, type AdminRuntimeOptions, createAdminRuntime } from "./server/runtime";

/** The bindings + secrets a per-site Worker provides (see `wrangler.jsonc`). */
export interface WorkerAdminEnv {
  /** D1 database binding (`d1_databases[].binding = "DB"`). */
  readonly DB: D1Binding;
  /** R2 media bucket binding (`r2_buckets[].binding = "BUCKET"`). Optional. */
  readonly BUCKET?: R2BucketLike;
  /** Signs sessions/CSRF. `wrangler secret put VOILA_AUTH_SECRET`. */
  readonly VOILA_AUTH_SECRET: string;
  /** Deployed origin, e.g. `https://admin.acme.com`. */
  readonly VOILA_BASE_URL?: string;
  /** Resend API key for real magic-link email (`mailer: "resend"`). */
  readonly RESEND_API_KEY?: string;
  /**
   * Cloudflare Email Service binding (`send_email[].name = "EMAIL"`) for real
   * magic-link email without an API key (`mailer: "cloudflare"`).
   */
  readonly EMAIL?: SendEmailBindingLike;
  /** From address for magic-link email, e.g. `Acme <admin@acme.com>`. */
  readonly VOILA_AUTH_FROM?: string;
}

/**
 * Magic-link transport: `"cloudflare"` (the `EMAIL` binding), `"resend"`
 * (`RESEND_API_KEY`), `"console"` (links in the logs), or your own `Mailer`.
 */
export type WorkerMailer = "cloudflare" | "resend" | "console" | Mailer;

export interface CreateWorkerAdminOptions
  extends Pick<
    AdminRuntimeOptions,
    "basePath" | "sessionTtl" | "authenticator" | "access" | "sources"
  > {
  /** Override the ambient `cloudflare:workers` env (used in tests). */
  readonly env?: WorkerAdminEnv;
  /**
   * Local development — ignore `env.VOILA_BASE_URL` so Better Auth infers the
   * origin (and magic-link verify URLs) from each request. Under `vite dev` the
   * Cloudflare plugin injects `wrangler.jsonc` `vars` (including a production
   * `VOILA_BASE_URL`) into `env`, which would otherwise send the verify link to
   * the live site. Pass `dev: import.meta.env.DEV` from your `app/lib/server.ts`
   * — vite replaces it with `true` under `vite dev` and `false` in the
   * production build, so the deployed Worker still pins its origin.
   */
  readonly dev?: boolean;
  /**
   * Language of the magic-link email (`"fr-FR"` → French). Pass the same
   * value as `defineAdmin({ locale })`. Default English.
   */
  readonly locale?: string;
  /** Brand named in the email subject. Defaults to the config's `branding.name`. */
  readonly brand?: string;
  /**
   * How magic links are sent. Omitted, the env decides: Resend when
   * `RESEND_API_KEY` + `VOILA_AUTH_FROM` are set, else Cloudflare Email Service
   * when the `EMAIL` binding + `VOILA_AUTH_FROM` are, else the console. Named
   * explicitly, a provider whose config is missing throws — except under `dev`,
   * where it falls back to the console.
   */
  readonly mailer?: WorkerMailer;
}

/**
 * The `Mailer` `createWorkerAdmin` hands to Better Auth (`undefined` → the
 * console mailer). Exported for tests and for hosts building their own runtime.
 */
export function resolveWorkerMailer(
  env: WorkerAdminEnv,
  options: Pick<CreateWorkerAdminOptions, "mailer" | "locale" | "dev">,
  brand: string,
): Mailer | undefined {
  const choice = options.mailer;
  if (typeof choice === "object") return choice;
  const from = env.VOILA_AUTH_FROM;
  const provider =
    choice ??
    (env.RESEND_API_KEY && from ? "resend" : env.EMAIL && from ? "cloudflare" : "console");
  const wording = { brand, locale: options.locale };

  if (provider === "resend") {
    if (env.RESEND_API_KEY && from) {
      return resendMailer({ apiKey: env.RESEND_API_KEY, from, ...wording });
    }
    return missingMailerConfig(options, "resend", "the RESEND_API_KEY secret and VOILA_AUTH_FROM");
  }
  if (provider === "cloudflare") {
    if (env.EMAIL && from) return cloudflareMailer({ binding: env.EMAIL, from, ...wording });
    return missingMailerConfig(
      options,
      "cloudflare",
      'the `"send_email": [{ "name": "EMAIL" }]` binding and VOILA_AUTH_FROM',
    );
  }
  return undefined;
}

function missingMailerConfig(
  options: Pick<CreateWorkerAdminOptions, "dev">,
  provider: string,
  needs: string,
): undefined {
  if (options.dev) return undefined;
  throw new Error(`createWorkerAdmin: mailer "${provider}" needs ${needs}.`);
}

/**
 * Build the admin runtime for a Cloudflare Worker from its `env`. The host's
 * `app/lib/server.ts` becomes a one-liner:
 *
 *     export const { database, auth, restHandler, authSecret } =
 *       createWorkerAdmin(config);
 */
export function createWorkerAdmin(
  config: NormalizedConfig,
  options: CreateWorkerAdminOptions = {},
): AdminRuntime {
  const env = options.env ?? (workerEnv as unknown as WorkerAdminEnv);

  const secret = env.VOILA_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "VOILA_AUTH_SECRET is not set. Run `wrangler secret put VOILA_AUTH_SECRET` — it signs " +
        "auth sessions, magic-link tokens, and the CSRF token.",
    );
  }

  const mailer = resolveWorkerMailer(env, options, options.brand ?? config.branding.name);

  return createAdminRuntime(config, {
    driver: makeD1Driver(env.DB),
    secret,
    storage: env.BUCKET ? makeR2Storage(env.BUCKET) : undefined,
    mailer,
    // In dev, drop the pinned origin so auth tracks the actual localhost port.
    baseUrl: options.dev ? undefined : env.VOILA_BASE_URL,
    basePath: options.basePath,
    sessionTtl: options.sessionTtl,
    authenticator: options.authenticator,
    access: options.access,
    sources: options.sources,
  });
}
