/**
 * Root entry — types + the auth-config helpers consumers reference from
 * `content.config.ts`. Server-only code lives under `/server`; middleware
 * under `/middleware`; mailers under `/mailers`.
 */

export type {
  AuthConfig,
  AuthEmailConfig,
  AuthMailer,
  MagicLinkMessage,
  MailerEnv,
  ResolvedAuthConfig,
} from "./types.ts";
export { DEFAULT_AUTH_CONFIG, resolveAuthConfig } from "./types.ts";
