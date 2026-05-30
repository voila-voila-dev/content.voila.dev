// Pick a `Mailer` Layer from env + resolved auth config. Precedence:
//   1. RESEND_API_KEY set → Resend.
//   2. SMTP_HOST set      → SMTP (SMTP_PORT defaults to 587).
//   3. otherwise          → console (logs the link).
// The `from` address is sourced from `email.from`, then `AUTH_EMAIL_FROM`, then
// a clearly-fake placeholder so misconfiguration shows up at runtime rather
// than pointing at a real address by accident.

import type { Layer } from "effect";
import type { MailerEnv, ResolvedAuthConfig } from "../types";
import { ConsoleMailerLive } from "./console";
import type { Mailer } from "./mailer";
import { ResendMailerLive } from "./resend";
import { SmtpMailerLive } from "./smtp";

const DEFAULT_FROM = "no-reply@example.com";

export const resolveMailerLayer = (
  config: ResolvedAuthConfig,
  env: MailerEnv = {},
): Layer.Layer<Mailer> => {
  const from = config.email.from ?? env.AUTH_EMAIL_FROM ?? DEFAULT_FROM;

  if (env.RESEND_API_KEY) {
    return ResendMailerLive({ apiKey: env.RESEND_API_KEY, from, brand: config.brand });
  }

  if (env.SMTP_HOST) {
    const port = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 587;
    if (Number.isNaN(port)) {
      throw new Error(`resolveMailerLayer: SMTP_PORT="${env.SMTP_PORT}" is not a number`);
    }
    return SmtpMailerLive({
      host: env.SMTP_HOST,
      port,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      secure: env.SMTP_SECURE === "true" ? true : env.SMTP_SECURE === "false" ? false : undefined,
      from,
      brand: config.brand,
    });
  }

  return ConsoleMailerLive;
};
