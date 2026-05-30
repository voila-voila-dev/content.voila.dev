import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Better Auth pulls a Kysely adapter we never use (the engine bridges over
      // its own SqlClient); the real module imports kysely exports the installed
      // version dropped, breaking the bundle. Redirect to a benign stub.
      "@better-auth/kysely-adapter": fileURLToPath(
        new URL("./src/stubs/better-auth-kysely-adapter.ts", import.meta.url),
      ),
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
