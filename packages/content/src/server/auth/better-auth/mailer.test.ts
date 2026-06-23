// Mailer unit tests: the console default logs the link; the Resend mailer POSTs
// the expected request and surfaces transport failures. `fetch` is injected so
// no network call happens.

import { describe, expect, it } from "bun:test";
import { consoleMailer, type MagicLinkMessage } from "./mailer";
import { resendMailer } from "./resend-mailer";

const message: MagicLinkMessage = {
  to: "user@example.com",
  url: "https://app.test/admin/api/auth/magic-link/verify?token=abc",
  token: "abc",
};

describe("consoleMailer", () => {
  it("logs the recipient and the link", async () => {
    const lines: string[] = [];
    await consoleMailer({ log: (...args) => lines.push(args.join(" ")) }).send(message);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("user@example.com");
    expect(lines[0]).toContain(message.url);
  });

  it("reports its id", () => {
    expect(consoleMailer().id).toBe("console");
  });
});

describe("resendMailer", () => {
  it("POSTs to the Resend API with from/to/subject and the link in the body", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchStub: typeof fetch = async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    };
    const mailer = resendMailer({
      apiKey: "re_test",
      from: "Voila <auth@app.test>",
      brand: "Acme",
      fetch: fetchStub,
    });
    await mailer.send(message);

    expect(captured?.url).toBe("https://api.resend.com/emails");
    expect(captured?.init.method).toBe("POST");
    const headers = new Headers(captured?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer re_test");
    const body = JSON.parse(String(captured?.init.body)) as Record<string, string>;
    expect(body.from).toBe("Voila <auth@app.test>");
    expect(body.to).toBe("user@example.com");
    expect(body.subject).toBe("Sign in to Acme");
    expect(body.html).toContain(message.url);
    expect(body.text).toContain(message.url);
  });

  it("honours a subject override", async () => {
    let subject: string | undefined;
    const fetchStub: typeof fetch = async (_url, init) => {
      subject = (JSON.parse(String(init?.body)) as { subject: string }).subject;
      return new Response("{}", { status: 200 });
    };
    await resendMailer({
      apiKey: "k",
      from: "a@b.dev",
      subject: "Your link",
      fetch: fetchStub,
    }).send(message);
    expect(subject).toBe("Your link");
  });

  it("throws when Resend returns a non-2xx", async () => {
    const fetchStub: typeof fetch = async () =>
      new Response("nope", { status: 422, statusText: "Unprocessable" });
    const mailer = resendMailer({ apiKey: "k", from: "a@b.dev", fetch: fetchStub });
    await expect(mailer.send(message)).rejects.toThrow(/422/);
  });
});
