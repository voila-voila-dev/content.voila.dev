import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { voila } from "@voila/content/vite";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function renderUnderRouter(Component: ComponentType, initialPath = "/"): string {
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <Component />
    </RouterContextProvider>,
  );
}

const ROOT = resolve(import.meta.dir, "..");

// Re-run the plugin against the playground root so the generated route
// files reflect the current generator sources, not whatever the last
// `vite dev` happened to write. Once re-generated, exercise the routes
// via in-memory Request / static React render to confirm the playground
// build serves the expected admin shell HTML + healthcheck JSON.
function regenerateRoutes() {
  const plugin = voila();
  const hook = plugin.configResolved;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  // biome-ignore lint/suspicious/noExplicitAny: minimal fake of ResolvedConfig.
  fn?.call(plugin as any, { root: ROOT } as any);
}

describe("playground admin routes (integration)", () => {
  test("GET /admin/api/health returns ok JSON", async () => {
    regenerateRoutes();
    const mod = await import(`${ROOT}/src/routes/admin/api/health.ts?t=${Date.now()}`);
    const handler = mod.Route.options.server.handlers.GET;
    const res: Response = await handler(new Request("http://localhost:8787/admin/api/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.time).toBe("string");
    expect(new Date(body.time).toString()).not.toBe("Invalid Date");
  });

  test("GET /admin/$ renders the admin shell with playground branding", async () => {
    regenerateRoutes();
    const mod = await import(`${ROOT}/src/routes/admin/$.tsx?t=${Date.now()}`);
    const Component = mod.Route.options.component;
    const html = renderUnderRouter(Component);
    expect(html).toContain('id="voila-admin"');
    expect(html).toContain('data-mount-admin="/admin"');
    expect(html).toContain('data-mount-api="/admin/api"');
    expect(html).toContain('data-brand-name="Voila Playground"');
  });

  test("GET /admin/$ head() returns branding-driven meta", async () => {
    regenerateRoutes();
    const mod = await import(`${ROOT}/src/routes/admin/$.tsx?t=${Date.now()}`);
    const head = mod.Route.options.head() as {
      meta: Array<{ title?: string; name?: string; content?: string }>;
    };
    const title = head.meta.find((m) => m.title)?.title;
    expect(title).toBe("Voila Playground");
    const mountAdmin = head.meta.find((m) => m.name === "voila:mount-admin")?.content;
    expect(mountAdmin).toBe("/admin");
  });
});
