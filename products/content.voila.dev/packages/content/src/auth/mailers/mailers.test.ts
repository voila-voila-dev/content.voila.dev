// Unit: mailer transports + the env-driven resolver. The console mailer logs
// the link; the Resend mailer maps SDK errors to `MailerError`; `resolveMailerLayer`
// picks the transport by env precedence (Resend → SMTP → console).

import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { MailerError } from "../errors";
import { resolveAuthConfig } from "../types";
import { consoleMailer } from "./console";
import { Mailer } from "./mailer";
import { renderMessage } from "./render";
import { type ResendLike, resendMailer } from "./resend";
import { resolveMailerLayer } from "./resolve";

const message = {
  to: "admin@acme.com",
  url: "https://acme.com/admin/api/auth/magic-link/verify?token=abc",
  token: "abc",
} as const;

describe("renderMessage", () => {
  it("interpolates the brand and escapes the URL", () => {
    const { subject, html, text } = renderMessage(message, { brand: "Acme & Co" });
    expect(subject).toBe("Sign in to Acme & Co");
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain(message.url);
    expect(text).toContain(message.url);
  });
});

describe("consoleMailer", () => {
  it("logs the magic-link URL to the injected logger", async () => {
    const lines: string[] = [];
    const mailer = consoleMailer({ log: (...args) => lines.push(args.join(" ")) });
    await Effect.runPromise(mailer.send(message));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(message.to);
    expect(lines[0]).toContain(message.url);
  });
});

describe("resendMailer", () => {
  it("sends through the injected client with rendered content", async () => {
    let sent: { from: string; to: string; subject: string } | undefined;
    const client: ResendLike = {
      emails: {
        send: async (args) => {
          sent = args;
          return { error: null };
        },
      },
    };
    const mailer = resendMailer({ apiKey: "k", from: "no-reply@acme.com", client, brand: "Acme" });
    await Effect.runPromise(mailer.send(message));
    expect(sent?.to).toBe(message.to);
    expect(sent?.from).toBe("no-reply@acme.com");
    expect(sent?.subject).toBe("Sign in to Acme");
  });

  it("maps an SDK error to MailerError", async () => {
    const client: ResendLike = {
      emails: { send: async () => ({ error: { message: "domain not verified" } }) },
    };
    const mailer = resendMailer({ apiKey: "k", from: "x@acme.com", client });
    const exit = await Effect.runPromiseExit(mailer.send(message));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = exit.cause._tag === "Fail" ? exit.cause.error : undefined;
      expect(err).toBeInstanceOf(MailerError);
    }
  });
});

describe("resolveMailerLayer", () => {
  const idOf = (layer: ReturnType<typeof resolveMailerLayer>) =>
    Effect.runSync(
      Effect.provide(
        Effect.map(Mailer, (m) => m.id),
        layer,
      ),
    );

  it("prefers Resend when RESEND_API_KEY is set", () => {
    expect(idOf(resolveMailerLayer(resolveAuthConfig(), { RESEND_API_KEY: "k" }))).toBe("resend");
  });

  it("falls back to SMTP when SMTP_HOST is set", () => {
    expect(idOf(resolveMailerLayer(resolveAuthConfig(), { SMTP_HOST: "smtp.acme.com" }))).toBe(
      "smtp",
    );
  });

  it("defaults to console with no env", () => {
    expect(idOf(resolveMailerLayer(resolveAuthConfig(), {}))).toBe("console");
  });

  it("rejects a non-numeric SMTP_PORT", () => {
    expect(() =>
      resolveMailerLayer(resolveAuthConfig(), { SMTP_HOST: "h", SMTP_PORT: "nope" }),
    ).toThrow(/SMTP_PORT/);
  });
});
