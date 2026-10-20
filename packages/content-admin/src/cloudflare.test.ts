// How `createWorkerAdmin` picks the magic-link mailer from the Worker env and
// the `mailer` option. The `cloudflare:workers` virtual module only exists on
// Workers, so it is stubbed before `./cloudflare` loads.

import { describe, expect, it, mock } from "bun:test";
import type { Mailer, SendEmailBindingLike } from "@voila/content/better-auth";

mock.module("cloudflare:workers", () => ({ env: {} }));
const { resolveWorkerMailer } = await import("./cloudflare");

const EMAIL: SendEmailBindingLike = { send: async () => ({ messageId: "m" }) };
const base = { DB: {} as never, VOILA_AUTH_SECRET: "s" };
const FROM = "Acme <admin@acme.dev>";

describe("resolveWorkerMailer", () => {
  it("defaults to Resend when its key is set (unchanged behaviour)", () => {
    const env = { ...base, RESEND_API_KEY: "re_x", EMAIL, VOILA_AUTH_FROM: FROM };
    expect(resolveWorkerMailer(env, {}, "Acme")?.id).toBe("resend");
  });

  it("falls back to the EMAIL binding without a Resend key", () => {
    const env = { ...base, EMAIL, VOILA_AUTH_FROM: FROM };
    expect(resolveWorkerMailer(env, {}, "Acme")?.id).toBe("cloudflare");
  });

  it("uses the console without a provider or without a sender", () => {
    expect(resolveWorkerMailer(base, {}, "Acme")).toBeUndefined();
    expect(resolveWorkerMailer({ ...base, EMAIL }, {}, "Acme")).toBeUndefined();
  });

  it("honours an explicit provider over the env", () => {
    const env = { ...base, RESEND_API_KEY: "re_x", EMAIL, VOILA_AUTH_FROM: FROM };
    expect(resolveWorkerMailer(env, { mailer: "cloudflare" }, "Acme")?.id).toBe("cloudflare");
    expect(resolveWorkerMailer(env, { mailer: "console" }, "Acme")).toBeUndefined();
  });

  it("returns a custom Mailer as is", () => {
    const custom: Mailer = { id: "smtp", send: async () => {} };
    expect(resolveWorkerMailer(base, { mailer: custom }, "Acme")).toBe(custom);
  });

  it("throws when an explicit provider is not configured, except under dev", () => {
    expect(() => resolveWorkerMailer(base, { mailer: "cloudflare" }, "Acme")).toThrow(
      /mailer "cloudflare" needs/,
    );
    expect(() => resolveWorkerMailer({ ...base, EMAIL }, { mailer: "resend" }, "Acme")).toThrow(
      /mailer "resend" needs/,
    );
    expect(resolveWorkerMailer(base, { mailer: "cloudflare", dev: true }, "Acme")).toBeUndefined();
  });
});
