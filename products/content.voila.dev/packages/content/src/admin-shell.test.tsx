import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "./admin-shell.tsx";
import { defineContent } from "./define.ts";
import { SetupPage } from "./setup-page.tsx";

describe("AdminShell", () => {
  test("renders the SPA mount point with branding + mount attributes", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderToStaticMarkup(<AdminShell config={content} />);
    expect(html).toContain('id="voila-admin"');
    expect(html).toContain('data-mount-admin="/admin"');
    expect(html).toContain('data-mount-api="/admin/api"');
    expect(html).toContain('data-brand-name="Acme CMS"');
  });

  test("does not render an <html> or <head> wrapper (leaf-route safe)", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderToStaticMarkup(<AdminShell config={content} />);
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<head>");
    expect(html).not.toContain("<body");
  });

  test("reflects custom mount paths", () => {
    const content = defineContent({ mount: { admin: "/studio", api: "/studio/api" } });
    const html = renderToStaticMarkup(<AdminShell config={content} />);
    expect(html).toContain('data-mount-admin="/studio"');
    expect(html).toContain('data-mount-api="/studio/api"');
  });

  test("falls back to 'Voila' when branding.name is unset", () => {
    const content = defineContent();
    const html = renderToStaticMarkup(<AdminShell config={content} />);
    expect(html).toContain('data-brand-name="Voila"');
  });
});

describe("SetupPage", () => {
  test("renders the setup placeholder with branding", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderToStaticMarkup(<SetupPage config={content} />);
    expect(html).toContain('id="voila-setup"');
    expect(html).toContain("Welcome to Acme CMS");
    expect(html).toContain("First-run setup is not implemented yet");
  });

  test("does not render an <html> or <head> wrapper (leaf-route safe)", () => {
    const content = defineContent();
    const html = renderToStaticMarkup(<SetupPage config={content} />);
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<head>");
    expect(html).not.toContain("<body");
  });
});
