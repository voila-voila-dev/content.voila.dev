import type { AuthMailer, MagicLinkMessage } from "../types.ts";

export interface ResendMailerOptions {
  /** Resend API key — usually `env.RESEND_API_KEY`. */
  apiKey: string;
  /** `From:` header. RFC 5322 address; the bare domain must be Resend-verified. */
  from: string;
  /**
   * Override the constructed Resend client. Tests pass a stub so we don't
   * have to mock the global `fetch`; production callers leave this undefined.
   */
  client?: ResendLike;
  /** Optional subject override. Default: `"Sign in to {brand} — magic link"`. */
  subject?: string;
  /** Brand name interpolated into the default subject + body. */
  brand?: string;
}

/**
 * Minimal slice of the Resend SDK we depend on. Keeps the runtime import
 * lazy (so a project with no Resend usage doesn't pay for the SDK) and lets
 * tests inject a fake without monkey-patching the module.
 */
export interface ResendLike {
  emails: {
    send(args: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    }): Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Resend-backed mailer. Lazy-loads the `resend` package on first send so the
 * SDK is excluded from the worker bundle when this mailer is unused. Throws
 * an explanatory error if the `resend` peer dep is missing.
 */
export function resendMailer(options: ResendMailerOptions): AuthMailer {
  let cached: Promise<ResendLike> | undefined;
  const getClient = (): Promise<ResendLike> => {
    if (options.client) return Promise.resolve(options.client);
    cached ??= loadResendClient(options.apiKey);
    return cached;
  };

  return {
    id: "resend",
    async send(message) {
      const client = await getClient();
      const { subject, html, text } = renderMessage(message, options);
      const result = await client.emails.send({
        from: options.from,
        to: message.to,
        subject,
        html,
        text,
      });
      if (result.error) {
        throw new Error(`resend send failed: ${result.error.message}`);
      }
    },
  };
}

async function loadResendClient(apiKey: string): Promise<ResendLike> {
  let mod: { Resend: new (key: string) => ResendLike };
  try {
    mod = (await import("resend")) as unknown as {
      Resend: new (key: string) => ResendLike;
    };
  } catch (cause) {
    throw new Error(
      "resendMailer: the `resend` package is not installed. Add it to your app's dependencies or supply `options.client`.",
      { cause },
    );
  }
  return new mod.Resend(apiKey);
}

export function renderMessage(
  message: MagicLinkMessage,
  options: { subject?: string; brand?: string },
): { subject: string; html: string; text: string } {
  const brand = options.brand ?? "Voila";
  const subject = options.subject ?? `Sign in to ${brand}`;
  const text = `Click the link below to sign in to ${brand}. The link expires in 5 minutes.\n\n${message.url}\n\nIf you did not request this email, you can safely ignore it.`;
  const html =
    `<p>Click the link below to sign in to <strong>${escapeHtml(brand)}</strong>. The link expires in 5 minutes.</p>` +
    `<p><a href="${escapeAttr(message.url)}">${escapeHtml(message.url)}</a></p>` +
    `<p style="color:#666;font-size:12px">If you did not request this email, you can safely ignore it.</p>`;
  return { subject, html, text };
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
