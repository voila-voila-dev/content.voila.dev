// `BetterAuthLive` — the default `Auth` implementation. Better Auth is a
// concrete detail inside this layer; it never leaks through the `Auth`
// interface. Requires a `SqlClient` (the auth tables live on the engine's
// connection via `./adapter`) and a `Mailer` (magic-link delivery). The captured
// `Runtime` bridges Better Auth's async adapter/mailer callbacks back into
// `Effect`.

import { SqlClient } from "@effect/sql/SqlClient";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Effect, Layer, Runtime } from "effect";
import { makeVoilaSqlAdapter } from "./adapter";
import { Auth, AuthSession } from "./auth";
import { Unauthorized } from "./errors";
import { Mailer } from "./mailers/mailer";
import { type AuthConfig, parseDurationSeconds, resolveAuthConfig } from "./types";

export interface BetterAuthOptions_ {
  /** Secret used to sign sessions + magic-link tokens (e.g. `env.VOILA_AUTH_SECRET`). */
  readonly secret: string;
}

/** The conventional mount path for the Better Auth catch-all route. */
export const VOILA_AUTH_BASE_PATH = "/admin/api/auth";

const isSecureBaseUrl = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).protocol === "https:";
  } catch {
    return true;
  }
};

// Merge user `authentication` overrides onto the facade options: scalars
// replace, `plugins` concatenate (the magic-link plugin always runs), and
// `advanced`/`session` shallow-merge so a partial override keeps the computed
// cookie/session defaults.
const mergeOptions = (
  base: BetterAuthOptions,
  overrides: Readonly<Record<string, unknown>> | undefined,
): BetterAuthOptions => {
  if (!overrides) return base;
  // biome-ignore lint/suspicious/noExplicitAny: structural merge of two opaque option shapes.
  const out: any = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "plugins" && Array.isArray(value)) {
      out.plugins = [...(base.plugins ?? []), ...value];
    } else if ((key === "advanced" || key === "session") && value && typeof value === "object") {
      // biome-ignore lint/suspicious/noExplicitAny: shallow merge of opaque sub-records.
      out[key] = { ...((base as any)[key] ?? {}), ...(value as Record<string, unknown>) };
    } else {
      out[key] = value;
    }
  }
  return out as BetterAuthOptions;
};

/**
 * Build the default Better Auth–backed `Auth` layer: magic-link sign-in over
 * the resolved `Mailer`, sessions persisted through the engine's `SqlClient`.
 */
export const BetterAuthLive = (
  config: AuthConfig,
  options: BetterAuthOptions_,
): Layer.Layer<Auth, never, SqlClient | Mailer> =>
  Layer.effect(
    Auth,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const mailer = yield* Mailer;
      const runtime = yield* Effect.runtime<never>();
      const resolved = resolveAuthConfig(config);

      const base: BetterAuthOptions = {
        secret: options.secret,
        baseURL: resolved.baseUrl,
        basePath: VOILA_AUTH_BASE_PATH,
        database: makeVoilaSqlAdapter(sql, runtime),
        emailAndPassword: { enabled: false },
        plugins: [
          magicLink({
            sendMagicLink: ({ email, url, token }) =>
              Runtime.runPromise(runtime)(mailer.send({ to: email, url, token })),
          }),
        ],
        session: { expiresIn: parseDurationSeconds(resolved.sessionTtl) },
        advanced: {
          defaultCookieAttributes: {
            sameSite: "lax",
            httpOnly: true,
            // `secure: true` makes browsers drop the cookie over http (local
            // `wrangler dev`); derive it from the base URL so prod stays secure.
            secure: isSecureBaseUrl(resolved.baseUrl),
          },
        },
      };

      const instance = betterAuth(mergeOptions(base, resolved.authentication));

      // Resolve fail-soft: any error from the auth backend means "no session"
      // (the caller decides whether that's an `Unauthorized`).
      const getSession = (request: Request): Effect.Effect<AuthSession | null> =>
        Effect.tryPromise(() => instance.api.getSession({ headers: request.headers })).pipe(
          Effect.map((res) =>
            res
              ? new AuthSession({
                  userId: res.user.id,
                  email: res.user.email,
                  expiresAt: new Date(res.session.expiresAt),
                })
              : null,
          ),
          Effect.orElseSucceed(() => null),
        );

      return {
        getSession,
        requireSession: (request) =>
          getSession(request).pipe(
            Effect.flatMap((session) =>
              session
                ? Effect.succeed(session)
                : Effect.fail(new Unauthorized({ message: "No active session." })),
            ),
          ),
        handler: (request) => Effect.promise(() => instance.handler(request)),
      };
    }),
  );
