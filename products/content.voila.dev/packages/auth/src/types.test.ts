import { describe, expect, test } from "bun:test";
import { DEFAULT_AUTH_CONFIG, resolveAuthConfig } from "./types.ts";

describe("resolveAuthConfig", () => {
  test("fills every field with defaults when input is undefined", () => {
    const out = resolveAuthConfig();
    expect(out.providers).toEqual(DEFAULT_AUTH_CONFIG.providers);
    expect(out.sessionTtl).toBe(DEFAULT_AUTH_CONFIG.sessionTtl);
    expect(out.roles).toEqual(DEFAULT_AUTH_CONFIG.roles);
    expect(out.email).toEqual({});
    expect(out.baseUrl).toBeUndefined();
  });

  test("preserves user-supplied roles + sessionTtl + baseUrl", () => {
    const out = resolveAuthConfig({
      sessionTtl: "30m",
      roles: ["admin", "editor"],
      baseUrl: "https://admin.example.com",
      email: { from: "no-reply@example.com" },
    });
    expect(out.sessionTtl).toBe("30m");
    expect(out.roles).toEqual(["admin", "editor"]);
    expect(out.baseUrl).toBe("https://admin.example.com");
    expect(out.email.from).toBe("no-reply@example.com");
  });
});
