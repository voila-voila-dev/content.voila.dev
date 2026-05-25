import type { AuthEmailConfig, AuthMailer, MailerEnv } from "../types.ts";
import { consoleMailer } from "./console.ts";
import { resendMailer } from "./resend.ts";
import { smtpMailer } from "./smtp.ts";

export interface ResolveMailerOptions {
  /** Config block from `content.config.ts` (`auth.email`). */
  email: AuthEmailConfig;
  /** Env source — `process.env`, the worker `env`, or any keyed object. */
  env: MailerEnv;
  /** Brand interpolated into the default subject/body. */
  brand?: string;
  /** Logger used by the console fallback. */
  logger?: { log(...args: unknown[]): void };
}

const DEFAULT_FROM = "no-reply@example.com";

/**
 * Pick a mailer based on environment + user config.
 *
 * Precedence:
 * 1. `email.mailer` — explicit override always wins.
 * 2. `RESEND_API_KEY` set → `resendMailer`.
 * 3. `SMTP_HOST` set → `smtpMailer` (`SMTP_PORT` defaults to 587).
 * 4. Otherwise → `consoleMailer`.
 *
 * The `from` address is sourced from `email.from`, then `AUTH_EMAIL_FROM`,
 * then a clearly-fake `no-reply@example.com` placeholder so misconfiguration
 * shows up at runtime instead of pointing at a real address by accident.
 */
export function resolveMailer(options: ResolveMailerOptions): AuthMailer {
  const { email, env } = options;
  if (email.mailer) return email.mailer;

  const from = email.from ?? env.AUTH_EMAIL_FROM ?? DEFAULT_FROM;

  if (env.RESEND_API_KEY) {
    return resendMailer({ apiKey: env.RESEND_API_KEY, from, brand: options.brand });
  }

  if (env.SMTP_HOST) {
    const port = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 587;
    if (Number.isNaN(port)) {
      throw new Error(`resolveMailer: SMTP_PORT="${env.SMTP_PORT}" is not a number`);
    }
    return smtpMailer({
      host: env.SMTP_HOST,
      port,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      secure: env.SMTP_SECURE === "true" ? true : env.SMTP_SECURE === "false" ? false : undefined,
      from,
      brand: options.brand,
    });
  }

  return consoleMailer(options.logger);
}
