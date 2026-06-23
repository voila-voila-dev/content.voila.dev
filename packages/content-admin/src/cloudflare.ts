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
import { resendMailer } from "@voila/content/better-auth";
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
  /** Resend API key for real magic-link email; absent → console mailer. */
  readonly RESEND_API_KEY?: string;
  /** From address for magic-link email, e.g. `Acme <admin@acme.com>`. */
  readonly VOILA_AUTH_FROM?: string;
}

export interface CreateWorkerAdminOptions
  extends Pick<AdminRuntimeOptions, "basePath" | "sessionTtl" | "authenticator" | "access"> {
  /** Override the ambient `cloudflare:workers` env (used in tests). */
  readonly env?: WorkerAdminEnv;
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

  const mailer =
    env.RESEND_API_KEY && env.VOILA_AUTH_FROM
      ? resendMailer({ apiKey: env.RESEND_API_KEY, from: env.VOILA_AUTH_FROM })
      : undefined;

  return createAdminRuntime(config, {
    driver: makeD1Driver(env.DB),
    secret,
    storage: env.BUCKET ? makeR2Storage(env.BUCKET) : undefined,
    mailer,
    baseUrl: env.VOILA_BASE_URL,
    basePath: options.basePath,
    sessionTtl: options.sessionTtl,
    authenticator: options.authenticator,
    access: options.access,
  });
}
