import { describe, expect, test } from "bun:test";
import { type ResendLike, renderMessage, resendMailer } from "./resend.ts";

function fakeResend(captured: Array<{ to: string; subject: string; html: string }>): ResendLike {
  return {
    emails: {
      async send(args) {
        captured.push({ to: args.to, subject: args.subject, html: args.html });
        return { error: null };
      },
    },
  };
}

describe("resendMailer", () => {
  test("forwards the rendered subject + html via the injected client", async () => {
    const captured: Array<{ to: string; subject: string; html: string }> = [];
    const mailer = resendMailer({
      apiKey: "stub",
      from: "Voila <no-reply@example.com>",
      client: fakeResend(captured),
      brand: "Acme CMS",
    });
    await mailer.send({
      to: "you@example.com",
      url: "https://app.example.com/verify?token=abc",
      token: "abc",
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.to).toBe("you@example.com");
    expect(captured[0]?.subject).toBe("Sign in to Acme CMS");
    expect(captured[0]?.html).toContain("https://app.example.com/verify?token=abc");
    expect(captured[0]?.html).toContain("Acme CMS");
  });

  test("throws when the client reports a Resend error", async () => {
    const client: ResendLike = {
      emails: {
        async send() {
          return { error: { message: "bad recipient" } };
        },
      },
    };
    const mailer = resendMailer({
      apiKey: "stub",
      from: "no-reply@example.com",
      client,
    });
    await expect(mailer.send({ to: "x@y", url: "https://x/", token: "t" })).rejects.toThrow(
      /resend send failed: bad recipient/,
    );
  });
});

describe("renderMessage", () => {
  test("escapes brand + URL for HTML", () => {
    const out = renderMessage(
      { to: "x@y.z", url: "https://app/?q=<script>", token: "tok" },
      { brand: "Acme & Co" },
    );
    expect(out.html).toContain("Acme &amp; Co");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.text).toContain("https://app/?q=<script>");
  });
});
