import { describe, expect, test } from "bun:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "./admin-shell.tsx";
import { defineCollection, defineContent, defineSingleton } from "./define.ts";
import { SetupPage } from "./setup-page.tsx";

/**
 * AdminShell uses TanStack Router primitives (`Link`, `useLocation`) for the
 * sidebar. SSR snapshot tests therefore need a router in scope — we hand-roll
 * a memory router seeded at the admin mount path so active-state assertions
 * stay deterministic.
 */
function renderUnderRouter(node: ReactNode, initialPath = "/") {
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>{node}</RouterContextProvider>,
  );
}

describe("AdminShell", () => {
  test("renders the SPA mount point with branding + mount attributes", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderUnderRouter(<AdminShell config={content} />);
    expect(html).toContain('id="voila-admin"');
    expect(html).toContain('data-mount-admin="/admin"');
    expect(html).toContain('data-mount-api="/admin/api"');
    expect(html).toContain('data-brand-name="Acme CMS"');
  });

  test("does not render an <html> or <head> wrapper (leaf-route safe)", () => {
    const content = defineContent({ branding: { name: "Acme CMS" } });
    const html = renderUnderRouter(<AdminShell config={content} />);
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<head>");
    expect(html).not.toContain("<body");
  });

  test("reflects custom mount paths", () => {
    const content = defineContent({ mount: { admin: "/studio", api: "/studio/api" } });
    const html = renderUnderRouter(<AdminShell config={content} />);
    expect(html).toContain('data-mount-admin="/studio"');
    expect(html).toContain('data-mount-api="/studio/api"');
  });

  test("falls back to 'Voila' when branding.name is unset", () => {
    const content = defineContent();
    const html = renderUnderRouter(<AdminShell config={content} />);
    expect(html).toContain('data-brand-name="Voila"');
  });

  test("renders collection + singleton entries in the sidebar", () => {
    const content = defineContent({
      collections: [defineCollection({ slug: "posts", label: "Posts", fields: {} })],
      singletons: [defineSingleton({ slug: "config", label: "Site config", fields: {} })],
    });
    const html = renderUnderRouter(<AdminShell config={content} />);
    expect(html).toContain("Posts");
    expect(html).toContain("Site config");
    expect(html).toContain('href="/admin/collections/posts"');
    expect(html).toContain('href="/admin/singletons/config"');
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
