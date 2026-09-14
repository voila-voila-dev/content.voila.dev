// `resolveAdmission`: the session guard's view of the access policy.

import { describe, expect, it } from "bun:test";
import type { AccessPolicy, Authenticator } from "@voila/content/server";
import { resolveAdmission } from "./loaders";

const signedIn: Authenticator = {
  authenticate: async () => ({ id: "u1", email: "a@b.co" }),
};
const signedOut: Authenticator = { authenticate: async () => null };
const noEmail: Authenticator = { authenticate: async () => ({ id: "u2" }) };
const request = new Request("https://x/admin");

describe("resolveAdmission", () => {
  it("returns null when signed out", async () => {
    const policy: AccessPolicy = { access: () => true };
    expect(
      await resolveAdmission({ auth: { authenticator: signedOut }, policy }, request),
    ).toBeNull();
  });

  it("admits any session when the policy has no `admits` check", async () => {
    const policy: AccessPolicy = { access: () => true };
    const result = await resolveAdmission({ auth: { authenticator: signedIn }, policy }, request);
    expect(result).toEqual({ user: { id: "u1", email: "a@b.co" }, admitted: true });
  });

  it("asks the policy about the session's email", async () => {
    const policy: AccessPolicy = { access: () => true, admits: async (e) => e === "a@b.co" };
    const yes = await resolveAdmission({ auth: { authenticator: signedIn }, policy }, request);
    expect(yes?.admitted).toBe(true);
    const deny: AccessPolicy = { access: () => true, admits: async () => false };
    const no = await resolveAdmission({ auth: { authenticator: signedIn }, policy: deny }, request);
    expect(no?.admitted).toBe(false);
  });

  it("denies a session without an email when the policy needs one", async () => {
    const policy: AccessPolicy = { access: () => true, admits: async () => true };
    const result = await resolveAdmission({ auth: { authenticator: noEmail }, policy }, request);
    expect(result?.admitted).toBe(false);
  });
});
