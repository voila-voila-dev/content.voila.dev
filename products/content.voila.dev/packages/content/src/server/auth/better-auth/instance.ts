// `makeBetterAuth` — the default `Authenticator`, backed by Better Auth with
// magic-link sign-in. Better Auth is a concrete detail inside this module; it
// never leaks through the `Authenticator` seam the REST guard consumes. The
// bridge needs a `SqlDriver` (auth tables share the engine's connection via
// `./adapter`) and a `Mailer` (magic-link delivery).
//
// Returns three things: the raw `instance` (escape hatch for the host), a
// `handler` that serves Better Auth's own routes (sign-in, verify, sign-out, …),
// and an `authenticator` — a `Request → Principal | null` resolver to pass
// straight to `createRestHandler({ auth })`.

import { type BetterAuthOptions, betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import type { SqlDriver } from "../../database/driver";
import type { Authenticator } from "../authenticator";
import type { Principal } from "../principal";
import { makeSqlAdapter } from "./adapter";
import type { Mailer } from "./mailer";

/** The conventional mount path for Better Auth's catch-all route. */
export const DEFAULT_AUTH_BASE_PATH = "/admin/api/auth";
const DEFAULT_BASE_URL = "http://localhost";
const DEFAULT_SESSION_TTL = "7d";

export interface BetterAuthOptions_ {
  /** Secret used to sign sessions + magic-link tokens (e.g. `env.VOILA_AUTH_SECRET`). */
  readonly secret: string;
  /** The engine's SQL connection — the auth tables live here. */
  readonly driver: SqlDriver;
  /** Magic-link email transport. */
  readonly mailer: Mailer;
  /** Absolute deployment URL; used for `baseURL` + magic-link verify URLs. */
  readonly baseUrl?: string;
  /** Session lifetime as a duration string (`"60s"`, `"24h"`, `"7d"`, `"2w"`). Default `"7d"`. */
  readonly sessionTtl?: string;
  /** Mount path for the Better Auth routes. Default `/admin/api/auth`. */
  readonly basePath?: string;
  /** Raw Better Auth options, shallow-merged on top of the computed defaults. */
  readonly betterAuth?: Readonly<Record<string, unknown>>;
}

export interface BetterAuthBridge {
  /** The underlying Better Auth instance (escape hatch). */
  readonly instance: ReturnType<typeof betterAuth>;
  /** `Request → Principal | null` resolver for `createRestHandler({ auth })`. */
  readonly authenticator: Authenticator;
  /** Serves the Better Auth routes (sign-in, verify, sign-out). */
  readonly handler: (request: Request) => Promise<Response>;
  /** The path the auth routes are mounted under. */
  readonly basePath: string;
}

/**
 * Parse a duration string into seconds. Accepts `Ns`, `Nm`, `Nh`, `Nd`, `Nw`.
 * Throws on malformed input so a typo in config fails loudly at construction
 * time instead of silently defaulting.
 */
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(input);
  if (!match?.[1] || !match[2]) {
    throw new Error(
      `auth: invalid sessionTtl "${input}" — expected forms like "60s", "30m", "24h", "7d", "2w"`,
    );
  }
  const n = Number(match[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 }[match[2]] ?? 1;
  return n * unit;
}

function isSecureBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).protocol === "https:";
  } catch {
    return true;
  }
}

/** Build the default Better Auth–backed bridge. */
export function makeBetterAuth(options: BetterAuthOptions_): BetterAuthBridge {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const basePath = options.basePath ?? DEFAULT_AUTH_BASE_PATH;

  const base: BetterAuthOptions = {
    secret: options.secret,
    baseURL: baseUrl,
    basePath,
    database: makeSqlAdapter(options.driver),
    emailAndPassword: { enabled: false },
    plugins: [
      magicLink({
        sendMagicLink: ({ email, url, token }) => options.mailer.send({ to: email, url, token }),
      }),
    ],
    session: { expiresIn: parseDurationSeconds(options.sessionTtl ?? DEFAULT_SESSION_TTL) },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        httpOnly: true,
        // `secure: true` makes browsers drop the cookie over http (local
        // `wrangler dev`); derive it from the base URL so prod stays secure.
        secure: isSecureBaseUrl(baseUrl),
      },
    },
    ...options.betterAuth,
  };

  const instance = betterAuth(base);

  const authenticator: Authenticator = {
    async authenticate(request) {
      try {
        const result = await instance.api.getSession({ headers: request.headers });
        if (!result) return null;
        const principal: Principal = { id: result.user.id, email: result.user.email };
        return principal;
      } catch {
        // Fail soft: any backend error means "no session", which the guard turns
        // into a 401 — an auth outage never surfaces as a 500 from a read route.
        return null;
      }
    },
  };

  return {
    instance,
    authenticator,
    handler: (request) => instance.handler(request),
    basePath,
  };
}
