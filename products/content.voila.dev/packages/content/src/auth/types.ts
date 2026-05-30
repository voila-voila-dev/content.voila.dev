// Public auth-config surface + the resolved shape. Kept independent of
// better-auth's own option types so bumping that peer dep never breaks the
// `content.config.ts` API. `BetterAuthLive` consumes a `ResolvedAuthConfig`.

/** Payload handed to a `Mailer` when better-auth wants to deliver a magic link. */
export interface MagicLinkMessage {
  /** Recipient address as entered in the sign-in form. */
  readonly to: string;
  /** Fully-qualified `…/admin/api/auth/magic-link/verify?token=…` URL. */
  readonly url: string;
  /** Raw token, exposed so custom mailers can render it in the body. */
  readonly token: string;
}

/**
 * Subset of env vars the bundled mailer resolver reads. Pass `process.env`
 * (Node/Bun) or the Cloudflare worker `env` object — whichever the host has.
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
  readonly from?: string;
}

/** Escape-hatch slot for raw Better Auth options, deep-merged onto the facade. */
export type BetterAuthOverrides = Readonly<Record<string, unknown>>;

/** Top-level `auth` block accepted by `defineContent`. */
export interface AuthConfig {
  /** Session lifetime as a duration string (e.g. `"7d"`, `"24h"`). Default `"7d"`. */
  readonly sessionTtl?: string;
  /** Magic-link email transport config. Optional — auto-resolved from env. */
  readonly email?: AuthEmailConfig;
  /**
   * Absolute URL of the deployment, used as `baseURL` for the Better Auth
   * instance and to build magic-link verify URLs. Falls back to
   * `http://localhost` when omitted (dev/test).
   */
  readonly baseUrl?: string;
  /** Brand interpolated into the default magic-link subject + body. */
  readonly brand?: string;
  /** Raw Better Auth options merged on top of the typed facade. */
  readonly authentication?: BetterAuthOverrides;
}

/** `auth` block as it lands on a resolved config. */
export interface ResolvedAuthConfig {
  readonly sessionTtl: string;
  readonly email: AuthEmailConfig;
  readonly baseUrl: string;
  readonly brand: string;
  readonly authentication?: BetterAuthOverrides;
}

export const DEFAULT_AUTH_CONFIG: ResolvedAuthConfig = {
  sessionTtl: "7d",
  email: {},
  baseUrl: "http://localhost",
  brand: "Voila",
};

/** Normalize a user-supplied `AuthConfig` into a fully-defaulted shape. */
export const resolveAuthConfig = (input?: AuthConfig): ResolvedAuthConfig => ({
  sessionTtl: input?.sessionTtl ?? DEFAULT_AUTH_CONFIG.sessionTtl,
  email: input?.email ?? DEFAULT_AUTH_CONFIG.email,
  baseUrl: input?.baseUrl ?? DEFAULT_AUTH_CONFIG.baseUrl,
  brand: input?.brand ?? DEFAULT_AUTH_CONFIG.brand,
  authentication: input?.authentication,
});

/**
 * Parse a duration string into seconds. Accepts `Ns`, `Nm`, `Nh`, `Nd`, `Nw`.
 * Throws on malformed input so a typo in `content.config.ts` fails loudly at
 * construction time instead of silently defaulting.
 */
export const parseDurationSeconds = (input: string): number => {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(input);
  if (!match?.[1] || !match[2]) {
    throw new Error(
      `auth: invalid sessionTtl "${input}" — expected forms like "60s", "30m", "24h", "7d", "2w"`,
    );
  }
  const n = Number.parseInt(match[1], 10);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[match[2]] ?? 1;
  return n * multiplier;
};
