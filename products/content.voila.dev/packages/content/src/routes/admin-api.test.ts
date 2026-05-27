import { describe, expect, test } from "bun:test";
import {
  adminApiByFieldSource,
  adminApiByIdSource,
  adminApiCsrfSource,
  adminApiListSource,
  adminApiRestoreSource,
  cloudflareEnvDeclSource,
} from "./admin-api.ts";

describe("admin API route sources", () => {
  test("each data route declares its createFileRoute id, handlers, and auth wiring", () => {
    const cases = [
      {
        src: adminApiListSource("../../../content.config"),
        id: "/admin/api/$collection",
        handlers: ["handleList", "handleCreate"],
        methods: ["GET:", "POST:"],
        write: true, // POST create needs the CSRF secret
      },
      {
        src: adminApiByIdSource("../../../content.config"),
        id: "/admin/api/$collection/$id",
        handlers: ["handleFindById", "handleUpdate", "handleDelete"],
        methods: ["GET:", "PATCH:", "DELETE:"],
        write: true,
      },
      {
        src: adminApiByFieldSource("../../../content.config"),
        id: "/admin/api/$collection/by/$field/$value",
        handlers: ["handleFindByField"],
        methods: ["GET:"],
        write: false, // read-only ⇒ no CSRF secret
      },
      {
        src: adminApiRestoreSource("../../../content.config"),
        id: "/admin/api/$collection/$id/restore",
        handlers: ["handleRestore"],
        methods: ["POST:"],
        write: true,
      },
    ];
    for (const { src, id, handlers, methods, write } of cases) {
      expect(src).toContain(`createFileRoute("${id}")`);
      for (const handler of handlers) expect(src).toContain(handler);
      for (const method of methods) expect(src).toContain(method);
      expect(src).toContain('import { env } from "cloudflare:workers"');
      expect(src).toContain("d1FromBinding(env.DATABASE)");
      expect(src).toContain('import content from "../../../content.config"');
      // Every data route injects the session resolver so the API self-enforces auth.
      expect(src).toContain('import { getSessionSafe } from "@voila/content-auth/middleware"');
      expect(src).toContain('import { getAuth } from "../-auth-server"');
      expect(src).toContain("getSession: (request: Request) => getSessionSafe(getAuth(), request)");
      expect(src).toContain(", auth"); // passed into every handler call
      // Only write routes thread the CSRF secret.
      if (write) {
        expect(src).toContain("const csrfSecret = String(env.VOILA_AUTH_SECRET");
        expect(src).toContain("csrfSecret }");
      } else {
        expect(src).not.toContain("csrfSecret");
      }
    }
  });

  test("the read-by-field route stays GET-only", () => {
    const src = adminApiByFieldSource("../../../content.config");
    expect(src).not.toContain("POST:");
    expect(src).not.toContain("PATCH:");
    expect(src).not.toContain("DELETE:");
  });

  test("the csrf route is GET-only, public (no auth), signs with the secret, no DB", () => {
    const src = adminApiCsrfSource();
    expect(src).toContain('createFileRoute("/admin/api/csrf")');
    expect(src).toContain("handleCsrfToken({ request, csrfSecret })");
    expect(src).toContain("GET:");
    // Needs the secret to sign, but no session resolver and no DB binding.
    expect(src).toContain("const csrfSecret = String(env.VOILA_AUTH_SECRET");
    expect(src).not.toContain("getSessionSafe");
    expect(src).not.toContain("getAuth");
    expect(src).not.toContain("d1FromBinding");
  });

  test("emits an ambient cloudflare:workers env declaration", () => {
    const decl = cloudflareEnvDeclSource();
    expect(decl).toContain('declare module "cloudflare:workers"');
    expect(decl).toContain("export const env");
  });
});
