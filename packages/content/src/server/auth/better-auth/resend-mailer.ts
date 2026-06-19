// Resend-backed mailer over Resend's REST API. Deliberately HTTP-not-SDK: a bare
// `fetch` to `https://api.resend.com/emails` keeps the engine dependency-free and
// runs unchanged on Workers (no Node `resend` SDK to bundle). `fetch` is
// injectable so tests assert the request without a network call.

import type { MagicLinkMessage, Mailer } from "./mailer";

export interface ResendMailerOptions {
  /** Resend API key — usually `env.RESEND_API_KEY`. */
  readonly apiKey: string;
  /** `From:` header. The sending domain must be Resend-verified. */
  readonly from: string;
  /** Brand interpolated into the default subject. Default `"Voila"`. */
  readonly brand?: string;
  /** Subject override; otherwise `Sign in to <brand>`. */
  readonly subject?: string;
  /** Injected fetch (tests / custom transport). Defaults to global `fetch`. */
  readonly fetch?: typeof fetch;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function renderBody(message: MagicLinkMessage): { html: string; text: string } {
  return {
    text: `Sign in by opening this link:\n\n${message.url}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Sign in by clicking the link below:</p><p><a href="${message.url}">Sign in</a></p><p>If you didn't request this, ignore this email.</p>`,
  };
}

/** Build a Resend `Mailer`. */
export function resendMailer(options: ResendMailerOptions): Mailer {
  const doFetch = options.fetch ?? fetch;
  const subject = options.subject ?? `Sign in to ${options.brand ?? "Voila"}`;
  return {
    id: "resend",
    async send(message) {
      const { html, text } = renderBody(message);
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
