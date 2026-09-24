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
  /** Subject override; otherwise `Sign in to <brand>` (or its `locale` wording). */
  readonly subject?: string;
  /**
   * Language of the default subject and body, as a BCP 47 locale: `"fr"` /
   * `"fr-FR"` write the email in French; anything else in English.
   */
  readonly locale?: string;
  /** Injected fetch (tests / custom transport). Defaults to global `fetch`. */
  readonly fetch?: typeof fetch;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface EmailCopy {
  readonly subject: (brand: string) => string;
  readonly intro: string;
  readonly introHtml: string;
  readonly button: string;
  readonly ignore: string;
}

const COPY: Readonly<Record<string, EmailCopy>> = {
  en: {
    subject: (brand) => `Sign in to ${brand}`,
    intro: "Sign in by opening this link:",
    introHtml: "Sign in by clicking the link below:",
    button: "Sign in",
    ignore: "If you didn't request this, ignore this email.",
  },
  fr: {
    subject: (brand) => `Connexion à ${brand}`,
    intro: "Pour vous connecter, ouvrez ce lien :",
    introHtml: "Pour vous connecter, cliquez sur le lien ci-dessous :",
    button: "Me connecter",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  },
};

function copyFor(locale: string | undefined): EmailCopy {
  const language = locale?.toLowerCase().split(/[-_]/)[0] ?? "en";
  return COPY[language] ?? (COPY.en as EmailCopy);
}

function renderBody(message: MagicLinkMessage, copy: EmailCopy): { html: string; text: string } {
  return {
    text: `${copy.intro}\n\n${message.url}\n\n${copy.ignore}`,
    html: `<p>${copy.introHtml}</p><p><a href="${message.url}">${copy.button}</a></p><p>${copy.ignore}</p>`,
  };
}

/** Build a Resend `Mailer`. */
export function resendMailer(options: ResendMailerOptions): Mailer {
  const doFetch = options.fetch ?? fetch;
  const copy = copyFor(options.locale);
  const subject = options.subject ?? copy.subject(options.brand ?? "Voila");
  return {
    id: "resend",
    async send(message) {
      const { html, text } = renderBody(message, copy);
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
