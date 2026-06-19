// The registry catalog — the source of truth `voila list` browses and `voila
// add` vends from. Each item names the files it owns (under `src/items/`), the
// npm packages those files import, and the registry items it composes. Keep the
// graph honest: every `registryDependencies` name must resolve to another item,
// and every file must exist on disk (the `registry.test.ts` integrity suite and
// the `resolve` cycle check enforce both).

import type { Registry } from "./types";

// Package versions the vended files import. Bumped together with releases.
const CONTENT = "^0.1.0";
const CONTENT_UI = "^0.1.0";
const RICH_TEXT = "^0.1.0";
const UI = "^0.1.0";
// Tested minor — Start still ships breaking conventions in minors, so this
// must match the create-voila template pin (see docs/2026-06-12 audit #2).
const TANSTACK_ROUTER = "~1.170.15";
const TANSTACK_START = "~1.168.25";
// Async state for admin reads/writes — must match the create-voila template pin.
const TANSTACK_QUERY = "^5.100.14";

export const registry: Registry = {
  items: [
    {
      name: "content-client",
      type: "lib",
      title: "Typed content client",
      description:
        "The typed REST client inferred from your config. Import `client` to read and write any collection.",
      dependencies: { "@voila/content": CONTENT },
      files: [{ path: "app/lib/content-client.ts" }],
    },
    {
      name: "admin-shell",
      type: "shell",
      title: "Admin shell",
      description:
        "The sidebar + header layout that your admin pages render into. Nav is built from your config.",
      dependencies: {
        // The shell's nav links render through TanStack's `<Link>`.
        "@tanstack/react-router": TANSTACK_ROUTER,
        "@voila/content-ui": CONTENT_UI,
        "@voila/ui": UI,
      },
      registryDependencies: ["content-client"],
      files: [{ path: "app/components/admin-layout.tsx" }],
    },
    {
      name: "admin-routes",
      type: "route",
      title: "Admin routes",
      description: "The `/admin` TanStack Start route that mounts the admin shell.",
      dependencies: { "@tanstack/react-router": TANSTACK_ROUTER },
      registryDependencies: ["admin-shell", "content-client", "admin-auth"],
      files: [{ path: "app/routes/admin.tsx" }],
    },
    {
      name: "admin-auth",
      type: "route",
      title: "Admin auth",
      description:
        "Magic-link login page (`/admin/login`) + the `fetchSession` server fn the `/admin` guard uses. Pairs with the auth-wired `app/lib/server.ts`.",
      dependencies: {
        "@tanstack/react-query": TANSTACK_QUERY,
        "@tanstack/react-router": TANSTACK_ROUTER,
        "@tanstack/react-start": TANSTACK_START,
      },
      files: [{ path: "app/lib/auth.ts" }, { path: "app/routes/admin_.login.tsx" }],
    },
    {
      name: "widgets",
      type: "lib",
      title: "Field widgets seam",
      description:
        "The single file your admin pages import field widgets from. Lets widget items (e.g. the rich-text editor) drop into every page by overwriting just this file.",
      dependencies: { "@voila/content-ui": CONTENT_UI },
      files: [{ path: "app/lib/widgets.ts" }],
    },
    {
      name: "rich-text-editor",
      type: "field",
      title: "Rich-text editor",
      description:
        "Plate-based editor for richText and markdown fields — replaces the plain textarea fallback (markdown keeps a raw-source toggle). Wires itself into every admin page by overwriting app/lib/widgets.ts.",
      dependencies: {
        "@voila/rich-text-editor": RICH_TEXT,
        "@voila/content": CONTENT,
        "@voila/content-ui": CONTENT_UI,
      },
      // Depends on the `widgets` seam and overwrites its file with a rich-text
      // flavored one (the resolver allows a dependent to override a dependency's
      // file). Adding this item alone still installs the seam first.
      registryDependencies: ["widgets"],
      files: [
        { path: "app/components/widgets/rich-text.tsx" },
        { path: "app/components/widgets/rich-text-display.tsx" },
        { path: "app/lib/widgets.rich-text.ts", target: "app/lib/widgets.ts" },
      ],
    },
  ],
};
