// Mailer unit tests: the console default logs the link; the Resend mailer POSTs
// the expected request and the Cloudflare mailer calls its `send_email` binding;
// both surface transport failures. `fetch` and the binding are injected so no
// network call happens.

import { describe, expect, it } from "bun:test";
import { cloudflareMailer, parseFromAddress, type SendEmailBindingLike } from "./cloudflare-mailer";
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

  it("writes the subject and body in the locale's language", async () => {
    let body: Record<string, string> | undefined;
    const fetchStub: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, string>;
      return new Response("{}", { status: 200 });
    };
    await resendMailer({
      apiKey: "k",
      from: "a@b.dev",
      brand: "Acme",
      locale: "fr-FR",
      fetch: fetchStub,
    }).send(message);
    expect(body?.subject).toBe("Connexion à Acme");
    expect(body?.text).toContain("Pour vous connecter");
    expect(body?.html).toContain(message.url);
  });

  it("throws when Resend returns a non-2xx", async () => {
    const fetchStub: typeof fetch = async () =>
      new Response("nope", { status: 422, statusText: "Unprocessable" });
    const mailer = resendMailer({ apiKey: "k", from: "a@b.dev", fetch: fetchStub });
    await expect(mailer.send(message)).rejects.toThrow(/422/);
  });
});

describe("cloudflareMailer", () => {
  function recordingBinding() {
    const sent: Parameters<SendEmailBindingLike["send"]>[0][] = [];
    const binding: SendEmailBindingLike = {
      async send(email) {
        sent.push(email);
        return { messageId: "m_1" };
      },
    };
    return { binding, sent };
  }

  it("sends through the binding with from/to/subject and the link in the body", async () => {
    const { binding, sent } = recordingBinding();
    const mailer = cloudflareMailer({ binding, from: "Acme <auth@app.test>", brand: "Acme" });
    await mailer.send(message);

    expect(mailer.id).toBe("cloudflare");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.from).toEqual({ email: "auth@app.test", name: "Acme" });
    expect(sent[0]?.to).toBe("user@example.com");
    expect(sent[0]?.subject).toBe("Sign in to Acme");
    expect(sent[0]?.html).toContain(message.url);
    expect(sent[0]?.text).toContain(message.url);
  });

  it("writes the subject and body in the locale's language", async () => {
    const { binding, sent } = recordingBinding();
    await cloudflareMailer({ binding, from: "a@b.dev", brand: "Acme", locale: "fr-FR" }).send(
      message,
    );
    expect(sent[0]?.from).toBe("a@b.dev");
    expect(sent[0]?.subject).toBe("Connexion à Acme");
    expect(sent[0]?.text).toContain("Pour vous connecter");
  });

  it("takes a `{ email, name }` sender as is", async () => {
    const { binding, sent } = recordingBinding();
    await cloudflareMailer({ binding, from: { email: "a@b.dev", name: "B" } }).send(message);
    expect(sent[0]?.from).toEqual({ email: "a@b.dev", name: "B" });
  });

  it("throws when the binding rejects", async () => {
    const binding: SendEmailBindingLike = {
      async send() {
        throw new Error("domain not verified");
      },
    };
    await expect(cloudflareMailer({ binding, from: "a@b.dev" }).send(message)).rejects.toThrow(
      /cloudflareMailer: send failed domain not verified/,
    );
  });
});

describe("parseFromAddress", () => {
  it("splits a display name from the address", () => {
    expect(parseFromAddress("Les Chalets de Pyrène <admin@mail.test>")).toEqual({
      email: "admin@mail.test",
      name: "Les Chalets de Pyrène",
    });
    expect(parseFromAddress('"Acme, Inc." <a@acme.dev>')).toEqual({
      email: "a@acme.dev",
      name: "Acme, Inc.",
    });
  });

  it("passes a bare address through", () => {
    expect(parseFromAddress(" a@acme.dev ")).toEqual({ email: "a@acme.dev" });
    expect(parseFromAddress("<a@acme.dev>")).toEqual({ email: "a@acme.dev" });
  });
});
