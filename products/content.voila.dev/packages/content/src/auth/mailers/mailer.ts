// The `Mailer` service seam. `BetterAuthLive`'s magic-link callback runs the
// resolved `Mailer.send` effect through its captured runtime, so the transport
// (Resend → SMTP → console) is swappable as a `Layer<Mailer>` without touching
// the auth bridge.

import { Context, type Effect } from "effect";
import type { MailerError } from "../errors";
import type { MagicLinkMessage } from "../types";

export interface MailerService {
  /** Stable name used in logs and `voila doctor` output. */
  readonly id: string;
  /** Deliver the magic-link email. Fails with `MailerError` on transport error. */
  readonly send: (message: MagicLinkMessage) => Effect.Effect<void, MailerError>;
}

export class Mailer extends Context.Tag("@voila/content-auth/Mailer")<Mailer, MailerService>() {}
