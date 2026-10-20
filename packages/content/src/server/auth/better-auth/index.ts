// Public surface of the Better Auth bridge — the concrete `Authenticator` that
// satisfies the seam in `@voila/content/server`. Exposed on its own package
// subpath (`@voila/content/better-auth`) so it's the *only* entry that pulls in
// `better-auth`: hosts using the seam with their own auth never load it.

export { firstUserAccess } from "./access";
export { makeSqlAdapter } from "./adapter";
export {
  type CloudflareEmailAddress,
  type CloudflareMailerOptions,
  cloudflareMailer,
  parseFromAddress,
  type SendEmailBindingLike,
} from "./cloudflare-mailer";
export {
  type BetterAuthBridge,
  type BetterAuthOptions_,
  DEFAULT_AUTH_BASE_PATH,
  makeBetterAuth,
  parseDurationSeconds,
} from "./instance";
export type { MagicLinkEmailOptions } from "./magic-link-email";
export { type ConsoleLogger, consoleMailer, type MagicLinkMessage, type Mailer } from "./mailer";
export { type ResendMailerOptions, resendMailer } from "./resend-mailer";
