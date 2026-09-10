// Sign-in failure copy. The rule these tests enforce is that a person who
// cannot sign in never sees a status code, always sees a next step, and is not
// invited to retry something that cannot succeed.

import { describe, expect, test } from "bun:test";
import { SIGN_IN_NETWORK_FAILURE, signInFailure } from "./sign-in-error";

const STATUSES = [400, 401, 403, 404, 422, 429, 500, 503, 418];

describe("signInFailure", () => {
  test("never leaks a status code into the message", () => {
    for (const status of STATUSES) {
      expect(signInFailure(status).message).not.toMatch(/\d{3}/);
    }
  });

  test("always ends in a complete sentence", () => {
    for (const status of STATUSES) {
      expect(signInFailure(status).message).toMatch(/\.$/);
    }
  });

  test("an unauthorised address is not retryable", () => {
    expect(signInFailure(403).retryable).toBe(false);
    expect(signInFailure(401).retryable).toBe(false);
    expect(signInFailure(404).retryable).toBe(false);
  });

  test("rate limiting tells the person to wait, and is retryable", () => {
    const failure = signInFailure(429);
    expect(failure.retryable).toBe(true);
    expect(failure.message).toContain("Wait a minute");
  });

  test("a typo-shaped failure points at the address", () => {
    expect(signInFailure(400).message).toContain("email address");
    expect(signInFailure(422).message).toContain("typos");
  });

  test("a server fault says it is ours and invites a retry", () => {
    expect(signInFailure(500).message).toContain("our side");
    expect(signInFailure(503).retryable).toBe(true);
  });

  test("an unmapped client status still gets usable copy", () => {
    const failure = signInFailure(418);
    expect(failure.message).toContain("Try again");
    expect(failure.retryable).toBe(true);
  });
});

describe("SIGN_IN_NETWORK_FAILURE", () => {
  test("names the connection and is retryable", () => {
    expect(SIGN_IN_NETWORK_FAILURE.message).toContain("connection");
    expect(SIGN_IN_NETWORK_FAILURE.retryable).toBe(true);
  });
});
