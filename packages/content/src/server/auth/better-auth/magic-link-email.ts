// Subject and body of the magic-link email, shared by every HTTP/binding mailer
// (Resend, Cloudflare Email Service) so the wording doesn't depend on the
// transport a site picks.

import type { MagicLinkMessage } from "./mailer";

/** Wording options common to the built-in mailers. */
export interface MagicLinkEmailOptions {
  /** Brand interpolated into the default subject. Default `"Voila"`. */
  readonly brand?: string;
  /** Subject override; otherwise `Sign in to <brand>` (or its `locale` wording). */
  readonly subject?: string;
  /**
   * Language of the default subject and body, as a BCP 47 locale: `"fr"` /
   * `"fr-FR"` write the email in French; anything else in English.
   */
  readonly locale?: string;
}

export interface MagicLinkEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

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

/**
 * Build the renderer once per mailer (locale + subject are fixed), then call it
 * per message.
 */
export function magicLinkEmail(
  options: MagicLinkEmailOptions,
): (message: MagicLinkMessage) => MagicLinkEmail {
  const copy = copyFor(options.locale);
  const subject = options.subject ?? copy.subject(options.brand ?? "Voila");
  return (message) => ({
    subject,
    text: `${copy.intro}\n\n${message.url}\n\n${copy.ignore}`,
    html: `<p>${copy.introHtml}</p><p><a href="${message.url}">${copy.button}</a></p><p>${copy.ignore}</p>`,
  });
}
