// Resend-backed mailer. Lazy-loads the `resend` SDK on first send so a project
// that never uses it doesn't pay the bundle cost; throws an explanatory error
// when the peer dep is missing. Tests inject `client` to avoid network/mocking.

import { Effect, Layer } from "effect";
import { MailerError } from "../errors";
import { Mailer } from "./mailer";
import { renderMessage } from "./render";

/** Minimal slice of the Resend SDK we depend on. */
export interface ResendLike {
  readonly emails: {
    readonly send: (args: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    }) => Promise<{ error: { message: string } | null }>;
  };
}

export interface ResendMailerOptions {
  /** Resend API key — usually `env.RESEND_API_KEY`. */
  readonly apiKey: string;
  /** `From:` header. The bare domain must be Resend-verified. */
  readonly from: string;
  /** Override the constructed Resend client (tests). */
  readonly client?: ResendLike;
  /** Optional subject override. */
  readonly subject?: string;
  /** Brand interpolated into the default subject + body. */
  readonly brand?: string;
}

const loadResendClient = (apiKey: string): Promise<ResendLike> =>
  import("resend" as string)
    .then((mod: { Resend: new (key: string) => ResendLike }) => new mod.Resend(apiKey))
    .catch((cause) => {
      throw new Error(
        "resendMailer: the `resend` package is not installed. Add it to your app's dependencies or supply `options.client`.",
        { cause },
      );
    });

/** Build a Resend `Mailer` service. */
export const resendMailer = (options: ResendMailerOptions): Mailer["Type"] => {
  let cached: Promise<ResendLike> | undefined;
  const getClient = (): Promise<ResendLike> => {
    if (options.client) return Promise.resolve(options.client);
    cached ??= loadResendClient(options.apiKey);
    return cached;
  };

  return {
    id: "resend",
    send: (message) =>
      Effect.tryPromise({
        try: async () => {
          const client = await getClient();
          const { subject, html, text } = renderMessage(message, options);
          const result = await client.emails.send({
            from: options.from,
            to: message.to,
            subject,
            html,
            text,
          });
          if (result.error) throw new Error(result.error.message);
        },
        catch: (cause) => new MailerError({ mailer: "resend", cause }),
      }),
  };
};

/** Resend `Mailer` Layer. */
export const ResendMailerLive = (options: ResendMailerOptions): Layer.Layer<Mailer> =>
  Layer.succeed(Mailer, resendMailer(options));
