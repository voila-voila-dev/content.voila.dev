/**
 * Server-side entry — builds the Better Auth instance the generated
 * `/admin/api/auth/$.ts` route delegates to. Lives in its own subpath so the
 * client bundle never imports better-auth + drizzle by accident.
 */

import { type DB, drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { DatabaseAdapter } from "@voila/content-database";
import { type Auth, type BetterAuthOptions, betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { resolveMailer } from "./mailers/resolve.ts";
import { sqliteSchema } from "./schema.ts";
import type { AuthMailer, MailerEnv, ResolvedAuthConfig } from "./types.ts";

export interface CreateAuthOptions {
  /** Resolved auth config from `content.config.ts`. */
  config: ResolvedAuthConfig;
  /** Database adapter — D1 in workers, SQLite locally, Postgres later. */
  adapter: Pick<DatabaseAdapter, "dialect" | "drizzle">;
  /**
   * Secret used to sign sessions and magic-link tokens. Provided by the
   * caller (usually `env.VOILA_AUTH_SECRET`) so we don't reach into
   * `process.env` from a worker context.
   */
  secret: string;
  /**
   * Env source the mailer resolver inspects. Pass `env` in workers or
   * `process.env` in Node/Bun.
   */
  env: MailerEnv;
  /**
   * Override the auto-resolved mailer. Tests use this; production paths let
   * `resolveMailer` pick based on `env`.
   */
  mailer?: AuthMailer;
  /** Brand interpolated into the default magic-link subject + body. */
  brand?: string;
  /**
   * Absolute base URL of the deployment (e.g. `https://admin.example.com`).
   * Required so magic-link verify URLs use the public origin instead of the
   * worker's internal hostname.
   */
  baseUrl?: string;
  /** Path the magic-link verifier redirects to on success. Default `"/admin"`. */
  successRedirect?: string;
  /** Path the magic-link verifier redirects to on failure. Default `"/admin/login?error=verify"`. */
  errorRedirect?: string;
}

/**
 * Build the Better Auth instance. Wires the magic-link plugin, the Drizzle
 * adapter (always SQLite dialect today; Postgres lands when the M2 adapter
 * arrives), and the resolved mailer.
 *
 * The returned `Auth` exposes:
 *   - `handler(request)` for the catch-all `/admin/api/auth/$` route
 *   - `api.getSession({ headers })` for the middleware
 */
export function createAuth(options: CreateAuthOptions): Auth {
  const provider = providerFromDialect(options.adapter.dialect);
  const mailer =
    options.mailer ??
    resolveMailer({
      email: options.config.email,
      env: options.env,
      brand: options.brand,
    });
  const baseURL = options.baseUrl ?? options.config.baseUrl;
  const secureCookies = isSecureBaseUrl(baseURL);

  const facadeOptions: BetterAuthOptions = {
    secret: options.secret,
    baseURL,
    basePath: "/admin/api/auth",
    database: drizzleAdapter(options.adapter.drizzle as DB, {
      provider,
      schema: provider === "sqlite" ? sqliteSchema : undefined,
    }),
    emailAndPassword: { enabled: false },
    plugins: [
      magicLink({
        async sendMagicLink({ email, url, token }) {
          await mailer.send({ to: email, url, token });
        },
      }),
    ],
    session: {
      expiresIn: parseDurationSeconds(options.config.sessionTtl),
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        httpOnly: true,
        // `secure: true` causes browsers to drop the cookie when the page is
        // loaded over http (i.e. `wrangler dev` on localhost). Derive from the
        // resolved base URL so prod stays secure and local dev still works.
        secure: secureCookies,
      },
    },
  };

  const merged = mergeBetterAuthOptions(facadeOptions, options.config.authentication);
  return betterAuth(merged);
}

/**
 * `true` when the resolved base URL is `https://` (or absent — production
 * defaults to https; local dev sets `baseUrl: "http://localhost:8787"`).
 */
export function isSecureBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return true;
  try {
    return new URL(baseUrl).protocol === "https:";
  } catch {
    return true;
  }
}

/**
 * Merge user-supplied `betterAuth` overrides onto the facade-constructed
 * options. The facade's `magicLink` plugin always runs; consumer plugins
 * append. `advanced` and `session` are shallow-merged so a partial override
 * (e.g. extra cookie attrs) keeps the facade's `secure`/`sameSite` defaults.
 */
export function mergeBetterAuthOptions(
  base: BetterAuthOptions,
  overrides: Readonly<Record<string, unknown>> | undefined,
): BetterAuthOptions {
  if (!overrides) return base;
  // biome-ignore lint/suspicious/noExplicitAny: structural merge bridging two opaque option shapes.
  const out: any = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "plugins" && Array.isArray(value)) {
      out.plugins = [...(base.plugins ?? []), ...(value as unknown[])];
      continue;
    }
    if (
      (key === "advanced" || key === "session") &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: shallow merge of opaque sub-records.
      const baseSection = ((base as any)[key] ?? {}) as Record<string, unknown>;
      out[key] = { ...baseSection, ...(value as Record<string, unknown>) };
      continue;
    }
    out[key] = value;
  }
  return out as BetterAuthOptions;
}

function providerFromDialect(dialect: "sqlite" | "postgres"): "sqlite" | "pg" {
  return dialect === "postgres" ? "pg" : "sqlite";
}

/**
 * Parse a duration string into seconds. Accepts `Ns`, `Nm`, `Nh`, `Nd`,
 * `Nw`. Throws on malformed input so a typo in `content.config.ts` fails
 * loudly at construction time instead of silently defaulting.
 */
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(input);
  if (!match || !match[1] || !match[2]) {
    throw new Error(
      `auth: invalid sessionTtl "${input}" — expected forms like "60s", "30m", "24h", "7d", "2w"`,
    );
  }
  const n = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multiplier =
    unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : unit === "d" ? 86400 : 604800;
  return n * multiplier;
}

export type VoilaAuth = Auth;
