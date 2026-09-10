import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Same wiring as `apps/demo.content.voila.dev`: TanStack Start on Cloudflare
// Workers. The Cloudflare plugin runs SSR in a local workerd (dev) and builds
// the Worker bundle (deploy), mapping the `ssr` environment onto workerd; the
// Start plugin wires file-based routing under `app/routes`. `cloudflare` must
// come first. Tailwind v4 is vite-plugin-driven; React Refresh (react()) is
// required for Start dev mode.
//
// This app is read-only — no admin, no auth, no maplibre — so it needs none of
// the demo's dependency-optimization workarounds (those exist for the CJS
// `use-sync-external-store` shim pulled in by @voila.dev/ui).
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({ srcDirectory: "app" }),
    react(),
    tailwindcss(),
  ],
});
