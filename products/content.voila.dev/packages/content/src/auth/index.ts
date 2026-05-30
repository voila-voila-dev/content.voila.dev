// `@voila/content/auth` — the `Auth` service seam + Better Auth bridge (M1).
// Magic-link sign-in delivered through a swappable `Mailer` Layer
// (Resend → SMTP → console), sessions persisted on the engine's `SqlClient`,
// and session enforcement as an `Rpc.Middleware`. The engine depends only on the
// `Auth` tag — `BetterAuthLive` is replaceable with any `Layer.Layer<Auth>`.

export { Auth, type AuthService, AuthSession, CurrentSession } from "./auth";
export {
  BetterAuthLive,
  type BetterAuthOptions_,
  VOILA_AUTH_BASE_PATH,
} from "./better-auth";
export { MailerError, Unauthorized } from "./errors";
export {
  type ConsoleLogger,
  ConsoleMailerLive,
  consoleMailer,
  Mailer,
  type MailerService,
  type RenderedMessage,
  type RenderOptions,
  type ResendLike,
  ResendMailerLive,
  type ResendMailerOptions,
  renderMessage,
  resendMailer,
  resolveMailerLayer,
  SmtpMailerLive,
  type SmtpMailerOptions,
  type SmtpTransporterLike,
  smtpMailer,
} from "./mailers";
export { SessionMiddleware, SessionMiddlewareLive } from "./middleware";
export { authTableStatements, authTablesSql } from "./schema";
export {
  type AuthConfig,
  type AuthEmailConfig,
  type BetterAuthOverrides,
  DEFAULT_AUTH_CONFIG,
  type MagicLinkMessage,
  type MailerEnv,
  parseDurationSeconds,
  type ResolvedAuthConfig,
  resolveAuthConfig,
} from "./types";
