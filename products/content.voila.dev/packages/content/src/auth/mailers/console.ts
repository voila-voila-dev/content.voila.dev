// Stdout mailer — the last-resort fallback for local dev when no Resend/SMTP
// credentials are set. Logs the magic-link URL so the developer can copy it
// from the terminal. Explicit by design: we'd rather make magic-link delivery
// loud than have it silently no-op.

import { Effect, Layer } from "effect";
import { Mailer } from "./mailer";

export interface ConsoleLogger {
  readonly log: (...args: ReadonlyArray<unknown>) => void;
}

/** Build a console `Mailer` with an optional injectable logger (tests). */
export const consoleMailer = (logger: ConsoleLogger = console): Mailer["Type"] => ({
  id: "console",
  send: (message) =>
    Effect.sync(() => {
      logger.log(`[voila/auth] magic link for ${message.to}: ${message.url}`);
    }),
});

/** Console `Mailer` Layer — the dev/test default. */
export const ConsoleMailerLive: Layer.Layer<Mailer> = Layer.succeed(Mailer, consoleMailer());
