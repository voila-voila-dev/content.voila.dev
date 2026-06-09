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
const UI = "^0.1.0";
const TANSTACK_ROUTER = "^1.0.0";

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
      dependencies: { "@voila/content-ui": CONTENT_UI, "@voila/ui": UI },
      registryDependencies: ["content-client"],
      files: [{ path: "app/components/admin-layout.tsx" }],
    },
    {
      name: "admin-routes",
      type: "route",
      title: "Admin routes",
      description: "The `/admin` TanStack Start route that mounts the admin shell.",
      dependencies: { "@tanstack/react-router": TANSTACK_ROUTER },
      registryDependencies: ["admin-shell", "content-client"],
      files: [{ path: "app/routes/admin.tsx" }],
    },
  ],
};
