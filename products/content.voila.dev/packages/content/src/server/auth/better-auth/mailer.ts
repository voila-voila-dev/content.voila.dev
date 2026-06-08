// The `Mailer` seam for magic-link delivery, plus the console default. Better
// Auth's magic-link plugin hands us `{ email, url, token }`; a `Mailer` turns
// that into a sent email. The transport (console → Resend → your own) is a
// swappable object, mirroring the `Authenticator`/`SqlDriver` seams: the engine
// ships the seam and a dev default, concrete transports plug in.

/** Payload handed to a `Mailer` when Better Auth wants to deliver a magic link. */
export interface MagicLinkMessage {
  /** Recipient address as entered in the sign-in form. */
  readonly to: string;
  /** Fully-qualified `…/admin/api/auth/magic-link/verify?token=…` URL. */
  readonly url: string;
  /** Raw token, exposed so custom mailers can render it in the body. */
  readonly token: string;
}

export interface Mailer {
  /** Stable name used in logs and diagnostics. */
  readonly id: string;
  /** Deliver the magic-link email. Rejects on transport failure. */
  send(message: MagicLinkMessage): Promise<void>;
}

/** Just the `console.log` slice the console mailer needs — injectable for tests. */
export interface ConsoleLogger {
  log(...args: ReadonlyArray<unknown>): void;
}

/**
 * Stdout mailer — the last-resort fallback for local dev when no Resend/SMTP
 * credentials are set. Logs the magic-link URL so the developer can copy it from
 * the terminal. Explicit by design: better to make delivery loud than to have it
 * silently no-op.
 */
export function consoleMailer(logger: ConsoleLogger = console): Mailer {
  return {
    id: "console",
    async send(message) {
      logger.log(`[voila/auth] magic link for ${message.to}: ${message.url}`);
    },
  };
}
