import type { AuthMailer } from "../types.ts";
import { renderMessage } from "./resend.ts";

export interface SmtpMailerOptions {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  /** `true` for implicit TLS (port 465); `false` for STARTTLS / plaintext. */
  secure?: boolean;
  /** `From:` header. */
  from: string;
  /** Brand name interpolated into the default subject. */
  brand?: string;
  /** Optional pre-built transporter (tests inject a stub here). */
  transporter?: SmtpTransporterLike;
}

/** Minimal slice of nodemailer's transporter we depend on. */
export interface SmtpTransporterLike {
  sendMail(args: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

interface NodemailerLike {
  createTransport(opts: unknown): SmtpTransporterLike;
}

/**
 * SMTP-backed fallback mailer. Uses nodemailer; the import is lazy so the
 * worker bundle stays clean when SMTP is unused. Nodemailer pulls in a
 * handful of Node built-ins (`net`, `tls`, `dns`), so this transport is only
 * viable on runtimes with `nodejs_compat` or a real Node/Bun host.
 */
export function smtpMailer(options: SmtpMailerOptions): AuthMailer {
  let cached: Promise<SmtpTransporterLike> | undefined;
  const getTransporter = (): Promise<SmtpTransporterLike> => {
    if (options.transporter) return Promise.resolve(options.transporter);
    cached ??= loadNodemailerTransporter(options);
    return cached;
  };

  return {
    id: "smtp",
    async send(message) {
      const transporter = await getTransporter();
      const { subject, html, text } = renderMessage(message, {
        brand: options.brand,
      });
      await transporter.sendMail({
        from: options.from,
        to: message.to,
        subject,
        html,
        text,
      });
    },
  };
}

async function loadNodemailerTransporter(options: SmtpMailerOptions): Promise<SmtpTransporterLike> {
  let mod: NodemailerLike;
  try {
    // `nodemailer` ships no published types; type the dynamic import via the
    // minimal local interface above so isolated declarations are happy.
    mod = (await import(/* @vite-ignore */ "nodemailer" as string)) as unknown as NodemailerLike;
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
}
