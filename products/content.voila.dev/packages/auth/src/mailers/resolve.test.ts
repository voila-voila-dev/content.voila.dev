import { describe, expect, test } from "bun:test";
import { consoleMailer } from "./console.ts";
import { resolveMailer } from "./resolve.ts";

describe("resolveMailer", () => {
  test("returns the explicit override unchanged", () => {
    const stub = consoleMailer({ log() {} });
    const out = resolveMailer({ email: { mailer: stub }, env: {} });
    expect(out).toBe(stub);
  });

  test("prefers Resend when RESEND_API_KEY is set", () => {
    const out = resolveMailer({
      email: {},
      env: { RESEND_API_KEY: "re_x" },
      brand: "Test",
    });
    expect(out.id).toBe("resend");
  });

  test("falls back to SMTP when SMTP_HOST is set and no Resend key", () => {
    const out = resolveMailer({
      email: {},
      env: { SMTP_HOST: "mail.example.com", SMTP_PORT: "587" },
    });
    expect(out.id).toBe("smtp");
  });

  test("rejects a non-numeric SMTP_PORT", () => {
    expect(() =>
      resolveMailer({ email: {}, env: { SMTP_HOST: "mail.example.com", SMTP_PORT: "not-a-port" } }),
    ).toThrow(/SMTP_PORT="not-a-port" is not a number/);
  });

  test("falls all the way back to the console mailer when no env is set", () => {
    const out = resolveMailer({ email: {}, env: {}, logger: { log() {} } });
    expect(out.id).toBe("console");
  });
});

describe("consoleMailer", () => {
  test("logs the magic link to the supplied logger", async () => {
    const lines: string[] = [];
    const mailer = consoleMailer({ log: (...args) => lines.push(args.join(" ")) });
    await mailer.send({
      to: "you@example.com",
      url: "https://app.example.com/admin/api/auth/magic-link/verify?token=abc",
      token: "abc",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("you@example.com");
    expect(lines[0]).toContain("token=abc");
  });
});
