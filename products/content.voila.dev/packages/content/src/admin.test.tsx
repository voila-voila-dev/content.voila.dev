import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { adminRouteOptions, setupRouteOptions } from "./admin.tsx";
import { defineContent } from "./define.ts";

describe("adminRouteOptions", () => {
  test("returns a route options object with a component", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const opts = adminRouteOptions(content);
    expect(typeof opts.component).toBe("function");
  });

  test("the component renders the admin shell with branding", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderToStaticMarkup(adminRouteOptions(content).component());
    expect(html).toContain("<title>Acme CMS</title>");
    expect(html).toContain('id="voila-admin"');
    expect(html).toContain('data-mount-admin="/admin"');
    expect(html).toContain('data-mount-api="/admin/api"');
    expect(html).toContain('data-brand-name="Acme CMS"');
  });

  test("the component reflects custom mount paths", () => {
    const content = defineContent({
      mount: { admin: "/studio", api: "/studio/api" },
    });
    const html = renderToStaticMarkup(adminRouteOptions(content).component());
    expect(html).toContain('data-mount-admin="/studio"');
    expect(html).toContain('data-mount-api="/studio/api"');
  });
});

describe("setupRouteOptions", () => {
  test("returns a route options object with a component", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const opts = setupRouteOptions(content);
    expect(typeof opts.component).toBe("function");
  });

  test("the component renders the setup placeholder", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderToStaticMarkup(setupRouteOptions(content).component());
    expect(html).toContain("<title>Setup — Acme CMS</title>");
    expect(html).toContain("Welcome to Acme CMS");
    expect(html).toContain("First-run setup is not implemented yet");
  });
});
