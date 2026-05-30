// Default magic-link email body. Pure — shared by every transport.

import type { MagicLinkMessage } from "../types";

export interface RenderOptions {
  readonly subject?: string;
  readonly brand?: string;
}

export interface RenderedMessage {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

export const renderMessage = (
  message: MagicLinkMessage,
  options: RenderOptions = {},
): RenderedMessage => {
  const brand = options.brand ?? "Voila";
  const subject = options.subject ?? `Sign in to ${brand}`;
  const text = `Click the link below to sign in to ${brand}. The link expires in 5 minutes.\n\n${message.url}\n\nIf you did not request this email, you can safely ignore it.`;
  const html =
    `<p>Click the link below to sign in to <strong>${escapeHtml(brand)}</strong>. The link expires in 5 minutes.</p>` +
    `<p><a href="${escapeHtml(message.url)}">${escapeHtml(message.url)}</a></p>` +
    `<p style="color:#666;font-size:12px">If you did not request this email, you can safely ignore it.</p>`;
  return { subject, html, text };
};
