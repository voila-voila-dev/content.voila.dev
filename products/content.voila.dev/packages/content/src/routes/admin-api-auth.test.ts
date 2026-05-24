import { describe, expect, test } from "bun:test";
import { adminApiAuthSplatSource, authSingletonSource } from "./admin-api-auth.ts";
import { adminLoginSource } from "./admin-login.ts";

describe("authSingletonSource", () => {
  test("imports the D1 binding + createAuth and caches the instance", () => {
    const src = authSingletonSource("../../content.config");
    expect(src).toContain('from "cloudflare:workers"');
    expect(src).toContain('from "@voila/content-auth/server"');
    expect(src).toContain("d1FromBinding(e.DATABASE)");
    expect(src).toContain('import content from "../../content.config"');
    expect(src).toContain("export function getAuth()");
    expect(src).toContain("if (cached) return cached;");
    expect(src).toContain("VOILA_AUTH_SECRET");
    // Q1 — the singleton must read content.auth, not hard-code it.
    expect(src).toContain("resolveAuthConfig(content.auth)");
  });
});

describe("adminApiAuthSplatSource", () => {
  test("declares the splat route id + every HTTP method", () => {
    const src = adminApiAuthSplatSource();
    expect(src).toContain('createFileRoute("/admin/api/auth/$")');
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]) {
      expect(src).toContain(`${method}: handle`);
    }
    expect(src).toContain('from "../../-auth-server"');
  });
});

describe("adminLoginSource", () => {
  test("declares the /admin/login route + uses LoginView", () => {
    const src = adminLoginSource("../../content.config");
    expect(src).toContain('createFileRoute("/admin/login")');
    expect(src).toContain('import { LoginView } from "@voila/content/internal"');
    expect(src).toContain('import content from "../../content.config"');
    expect(src).toContain("validateSearch");
  });
});
