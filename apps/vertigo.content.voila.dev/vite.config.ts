import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TanStack Start on Cloudflare Workers. The Cloudflare plugin runs SSR in a
// local workerd (dev) and builds the Worker bundle (deploy), mapping the `ssr`
// environment onto workerd; the Start plugin wires file-based routing under
// `app/routes`. `cloudflare` must come first. Tailwind v4 is vite-plugin-driven;
// React Refresh (react()) is required for Start dev mode.
//
// One app, two halves: the public cinema site at `/` and its admin at `/admin`,
// both against the same D1 binding. The admin half pulls in `@voila.dev/ui`, so
// this app now needs the same dependency-optimization workarounds the demo has
// (see below) — they only matter for the admin's dependency graph.
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({ srcDirectory: "app" }),
    react(),
    tailwindcss(),
  ],
  // The client environment also pre-bundles `use-sync-external-store` so its
  // named exports are exposed (esbuild can't see them through the package's
  // conditional-require shim file otherwise -> "does not provide an export
  // named 'useSyncExternalStore'" at hydration).
  optimizeDeps: {
    include: ["use-sync-external-store/shim", "use-sync-external-store/shim/with-selector"],
  },
  environments: {
    // Opt the workerd SSR environment into dependency optimization (esbuild
    // CJS->ESM). Without this the TanStack Start plugin leaves SSR deps
    // un-optimized, so CJS deps like `use-sync-external-store` (a transitive dep
    // of @base-ui/react / @voila.dev/ui) throw "module is not defined" in the
    // workerd dev runner at entry load. Production `vite build` bundles them, so
    // deploys are unaffected — this only fixes `vite dev`.
    ssr: {
      optimizeDeps: {
        noDiscovery: false,
        include: [
          "use-sync-external-store",
          "use-sync-external-store/shim",
          "use-sync-external-store/shim/with-selector",
        ],
      },
    },
  },
});
