import type { AuthMailer } from "../types.ts";

/**
 * Stdout mailer used as the last-resort fallback for local dev when no
 * Resend/SMTP credentials are configured. Prints the magic-link URL so the
 * developer can copy it from the terminal — explicit by design; we'd rather
 * make magic-link delivery loud than have it silently no-op.
 */
export function consoleMailer(logger: { log(...args: unknown[]): void } = console): AuthMailer {
  return {
    id: "console",
    async send({ to, url }) {
      logger.log(`[voila/auth] magic link for ${to}: ${url}`);
    },
  };
}
