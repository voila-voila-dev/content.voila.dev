// Resend-backed mailer over Resend's REST API. Deliberately HTTP-not-SDK: a bare
// `fetch` to `https://api.resend.com/emails` keeps the engine dependency-free and
// runs unchanged on Workers (no Node `resend` SDK to bundle). `fetch` is
// injectable so tests assert the request without a network call.

import { type MagicLinkEmailOptions, magicLinkEmail } from "./magic-link-email";
import type { Mailer } from "./mailer";

export interface ResendMailerOptions extends MagicLinkEmailOptions {
  /** Resend API key — usually `env.RESEND_API_KEY`. */
  readonly apiKey: string;
  /** `From:` header. The sending domain must be Resend-verified. */
  readonly from: string;
  /** Injected fetch (tests / custom transport). Defaults to global `fetch`. */
  readonly fetch?: typeof fetch;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Build a Resend `Mailer`. */
export function resendMailer(options: ResendMailerOptions): Mailer {
  const doFetch = options.fetch ?? fetch;
  const render = magicLinkEmail(options);
  return {
    id: "resend",
    async send(message) {
      const { subject, html, text } = render(message);
      const response = await doFetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from: options.from, to: message.to, subject, html, text }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`resendMailer: send failed (${response.status}) ${detail}`.trim());
      }
    },
  };
}
