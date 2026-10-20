// Cloudflare Email Service mailer over the Workers `send_email` binding
// (`"send_email": [{ "name": "EMAIL" }]` in wrangler.jsonc). No API key: the
// binding is the credential, and the `from` domain must be onboarded with
// `wrangler email sending enable <domain>`. The binding is typed structurally
// so the engine needs neither `@cloudflare/workers-types` nor a Worker to test.

import { type MagicLinkEmailOptions, magicLinkEmail } from "./magic-link-email";
import type { Mailer } from "./mailer";

/** A sender split into address and optional display name. */
export interface CloudflareEmailAddress {
  readonly email: string;
  readonly name?: string;
}

/**
 * Just the `send()` slice of the Workers `SendEmail` binding. Its sender is a
 * bare address or `{ email, name }` with a required name.
 */
export interface SendEmailBindingLike {
  send(message: {
    to: string;
    from: string | { readonly email: string; readonly name: string };
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

export interface CloudflareMailerOptions extends MagicLinkEmailOptions {
  /** The `send_email` binding — usually `env.EMAIL`. */
  readonly binding: SendEmailBindingLike;
  /**
   * Sender, as `Acme <admin@acme.com>`, a bare address, or `{ email, name }`.
   * Its domain must be onboarded on Cloudflare Email Sending.
   */
  readonly from: string | CloudflareEmailAddress;
}

/** `"Acme <a@acme.com>"` → `{ name: "Acme", email: "a@acme.com" }`; a bare address passes through. */
export function parseFromAddress(from: string): CloudflareEmailAddress {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]?.trim();
  const email = (match[2] as string).trim();
  return name ? { email, name } : { email };
}

/** Build a Cloudflare Email Service `Mailer`. */
export function cloudflareMailer(options: CloudflareMailerOptions): Mailer {
  const sender = typeof options.from === "string" ? parseFromAddress(options.from) : options.from;
  const from = sender.name ? { email: sender.email, name: sender.name } : sender.email;
  const render = magicLinkEmail(options);
  return {
    id: "cloudflare",
    async send(message) {
      const { subject, html, text } = render(message);
      try {
        await options.binding.send({ to: message.to, from, subject, html, text });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`cloudflareMailer: send failed ${detail}`.trim(), { cause: error });
      }
    },
  };
}
