import { describe, expect, test } from "bun:test";
import { defineContent } from "./define.ts";

describe("content.handle — healthcheck", () => {
  test("returns JSON at /admin/api/health", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/admin/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.name).toBe("@voila/content");
    expect(typeof body.version).toBe("string");
    expect(typeof body.time).toBe("string");
    expect(new Date(body.time as string).toString()).not.toBe("Invalid Date");
  });

  test("respects a custom api mount", async () => {
    const content = defineContent({ mount: { api: "/studio/api" } });
    const response = await content.handle(new Request("http://localhost/studio/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});

describe("content.handle — admin shell", () => {
  test("returns HTML at /admin", async () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const response = await content.handle(new Request("http://localhost/admin"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Acme CMS</title>");
    expect(html).toContain('id="voila-admin"');
    expect(html).toContain('data-mount-admin="/admin"');
    expect(html).toContain('data-mount-api="/admin/api"');
    expect(html).toContain('data-brand-name="Acme CMS"');
  });

  test("returns HTML for nested admin routes", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/admin/posts"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("uses 'Voila' as the default brand name", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/admin"));
    const html = await response.text();
    expect(html).toContain("<title>Voila</title>");
  });

  test("respects a custom admin mount", async () => {
    const content = defineContent({ mount: { admin: "/studio" } });
    const response = await content.handle(new Request("http://localhost/studio/posts"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("escapes branding values in the rendered HTML", async () => {
    const content = defineContent({ branding: { name: "<script>alert('x')</script>" } });
    const response = await content.handle(new Request("http://localhost/admin"));
    const html = await response.text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  test("includes a favicon link when configured", async () => {
    const content = defineContent({ branding: { favicon: "/favicon.ico" } });
    const response = await content.handle(new Request("http://localhost/admin"));
    const html = await response.text();
    expect(html).toContain('<link rel="icon" href="/favicon.ico"');
  });

  test("omits the favicon link by default", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/admin"));
    const html = await response.text();
    expect(html).not.toContain('rel="icon"');
  });

  test("emits an accent CSS variable when configured", async () => {
    const content = defineContent({ branding: { accent: "#FF6A00" } });
    const response = await content.handle(new Request("http://localhost/admin"));
    const html = await response.text();
    expect(html).toContain("--voila-color-accent: #FF6A00");
  });
});

describe("content.handle — first-run setup gate", () => {
  test("returns a setup placeholder at /admin/setup", async () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const response = await content.handle(new Request("http://localhost/admin/setup"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<title>Setup — Acme CMS</title>");
    expect(html).toContain("Welcome to Acme CMS");
    expect(html).toContain("First-run setup is not implemented yet");
  });
});

describe("content.handle — unknown routes", () => {
  test("returns 404 JSON for unknown api routes", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/admin/api/unknown"));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
  });

  test("returns 404 text outside both mounts", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/marketing"));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  test("does not treat /administrator as the admin mount", async () => {
    const content = defineContent();
    const response = await content.handle(new Request("http://localhost/administrator"));
    expect(response.status).toBe(404);
  });
});
