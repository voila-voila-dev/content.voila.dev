// SMTP-backed fallback mailer over nodemailer. The import is lazy so the worker
// bundle stays clean when SMTP is unused; nodemailer pulls in Node built-ins
// (`net`, `tls`, `dns`), so this transport needs `nodejs_compat` or a real
// Node/Bun host. Tests inject `transporter`.

import { Effect, Layer } from "effect";
import { MailerError } from "../errors";
import { Mailer } from "./mailer";
import { renderMessage } from "./render";

/** Minimal slice of nodemailer's transporter we depend on. */
export interface SmtpTransporterLike {
  readonly sendMail: (args: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }) => Promise<unknown>;
}

interface NodemailerLike {
  readonly createTransport: (opts: unknown) => SmtpTransporterLike;
}

export interface SmtpMailerOptions {
  readonly host: string;
  readonly port: number;
  readonly user?: string;
  readonly pass?: string;
  /** `true` for implicit TLS (port 465); `false` for STARTTLS / plaintext. */
  readonly secure?: boolean;
  /** `From:` header. */
  readonly from: string;
  /** Brand interpolated into the default subject. */
  readonly brand?: string;
  /** Pre-built transporter (tests inject a stub). */
  readonly transporter?: SmtpTransporterLike;
}

const loadTransporter = async (options: SmtpMailerOptions): Promise<SmtpTransporterLike> => {
  let mod: NodemailerLike;
  try {
    mod = (await import("nodemailer" as string)) as unknown as NodemailerLike;
  } catch (cause) {
    throw new Error(
      "smtpMailer: the `nodemailer` package is not installed. Add it to your app's dependencies or supply `options.transporter`.",
      { cause },
    );
  }
  const auth =
    options.user && options.pass ? { user: options.user, pass: options.pass } : undefined;
  return mod.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure ?? options.port === 465,
    auth,
  });
};

/** Build an SMTP `Mailer` service. */
export const smtpMailer = (options: SmtpMailerOptions): Mailer["Type"] => {
  let cached: Promise<SmtpTransporterLike> | undefined;
  const getTransporter = (): Promise<SmtpTransporterLike> => {
    if (options.transporter) return Promise.resolve(options.transporter);
    cached ??= loadTransporter(options);
    return cached;
  };

  return {
    id: "smtp",
    send: (message) =>
      Effect.tryPromise({
        try: async () => {
          const transporter = await getTransporter();
          const { subject, html, text } = renderMessage(message, { brand: options.brand });
          await transporter.sendMail({ from: options.from, to: message.to, subject, html, text });
        },
        catch: (cause) => new MailerError({ mailer: "smtp", cause }),
      }),
  };
};

/** SMTP `Mailer` Layer. */
export const SmtpMailerLive = (options: SmtpMailerOptions): Layer.Layer<Mailer> =>
  Layer.succeed(Mailer, smtpMailer(options));
