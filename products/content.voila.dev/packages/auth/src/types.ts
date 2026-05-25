/**
 * Auth-config surface added to `content.config.ts` under the optional `auth`
 * block. Kept independent of better-auth's own option types so the public API
 * doesn't break every time we bump that peer dep.
 */

/** Mailer plug-in used to deliver magic-link emails. */
export interface AuthMailer {
  /** Stable name used in logs and the `voila doctor` output. */
  readonly id: "resend" | "smtp" | "console" | (string & {});
  /** Send the magic-link email. Implementations should throw on failure. */
  send(args: MagicLinkMessage): Promise<void>;
}

/** Payload handed to a mailer when better-auth wants to deliver a magic link. */
export interface MagicLinkMessage {
  /** Recipient address as entered in the sign-in form. */
  to: string;
  /** Fully-qualified `https://…/admin/api/auth/magic-link/verify?token=…` URL. */
  url: string;
  /** Raw token, exposed so custom mailers can render it in the body. */
  token: string;
}

/**
 * Subset of the env vars the bundled mailer resolver reads. Pass `process.env`
 * (Node/Bun) or the Cloudflare worker `env` object — whichever is available
 * to the caller.
 */
export interface MailerEnv {
  readonly RESEND_API_KEY?: string;
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASS?: string;
  readonly SMTP_SECURE?: string;
  readonly AUTH_EMAIL_FROM?: string;
}

/** Email-delivery configuration for the magic-link plugin. */
export interface AuthEmailConfig {
  /** RFC 5322 address used as the `From:` header. */
  from?: string;
  /** Override the auto-resolved mailer. Useful for tests + custom transports. */
  mailer?: AuthMailer;
}

/**
 * Escape-hatch slot for raw Better Auth options. Documented in
 * `06-configuration.md` as `auth.authentication` — anything Better Auth supports
 * that isn't surfaced in the typed facade (passkeys, additional plugins,
 * advanced rate-limit config, etc.) flows through here. `createAuth` deep-
 * merges this onto the constructed options, with these rules:
 *
 *   - top-level scalars replace the facade defaults,
 *   - `plugins` are concatenated (the facade's magic-link plugin always runs),
 *   - `advanced` and `session` are shallow-merged so a partial override
 *     doesn't blow away the cookie attributes computed from `baseUrl`.
 *
 * Typed loosely as `Record<string, unknown>` so the public surface doesn't
 * pin a specific Better Auth version. The merge logic narrows internally.
 */
export type BetterAuthOverrides = Readonly<Record<string, unknown>>;

/** Top-level `auth` block accepted by `defineContent`. */
export interface AuthConfig {
  /**
   * Enabled providers. M1 ships `email` only; the union grows in later
   * milestones (`github`, `google`, etc.). Defaults to `['email']`.
   */
  providers?: ReadonlyArray<"email">;
  /** Session lifetime as a duration string (e.g. `"7d"`, `"24h"`). Default `"7d"`. */
  sessionTtl?: string;
  /**
   * Role tuple surfaced to `access` callbacks as a literal union. Stored as
   * `readonly string[]` here; the literal types are preserved at the
   * `defineContent` call site via `as const`.
   */
  roles?: readonly string[];
  /** Magic-link email transport. Optional — auto-resolved from env when omitted. */
  email?: AuthEmailConfig;
  /**
   * Absolute URL of the deployment, used as `baseURL` for the Better Auth
   * instance. When omitted, the value is derived per-request from the
   * incoming `Request` so previews on `*.workers.dev` and custom domains
   * both work without ceremony.
   */
  baseUrl?: string;
  /**
   * Raw Better Auth options merged on top of the typed facade. See
   * {@link BetterAuthOverrides} for merge semantics.
   */
  authentication?: BetterAuthOverrides;
}

/** `auth` block as it lands on a resolved `Content`. */
export interface ResolvedAuthConfig {
  readonly providers: ReadonlyArray<"email">;
  readonly sessionTtl: string;
  readonly roles: readonly string[];
  readonly email: AuthEmailConfig;
  readonly baseUrl?: string;
  readonly authentication?: BetterAuthOverrides;
}

export const DEFAULT_AUTH_CONFIG: ResolvedAuthConfig = {
  providers: ["email"],
  sessionTtl: "7d",
  roles: ["admin"],
  email: {},
};

/**
 * Normalize a user-supplied `AuthConfig` into a fully-defaulted shape.
 * Lives here (not in `define.ts`) so `@voila/content` can re-export it
 * without dragging better-auth into its dependency graph.
 */
export function resolveAuthConfig(input?: AuthConfig): ResolvedAuthConfig {
  return {
    providers: input?.providers ?? DEFAULT_AUTH_CONFIG.providers,
    sessionTtl: input?.sessionTtl ?? DEFAULT_AUTH_CONFIG.sessionTtl,
    roles: input?.roles ?? DEFAULT_AUTH_CONFIG.roles,
    email: input?.email ?? DEFAULT_AUTH_CONFIG.email,
    baseUrl: input?.baseUrl,
    authentication: input?.authentication,
  };
}
