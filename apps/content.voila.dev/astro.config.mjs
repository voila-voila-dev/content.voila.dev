// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";

// The Cloudflare adapter targets the Workers runtime and is only needed when
// building/deploying. Applying it during `astro dev` breaks the dev server, so
// we scope it to `astro build` and let `astro dev` run as a fast local server.
const isBuild = process.argv.includes("build");

// https://astro.build/config
export default defineConfig({
  // Canonical origin used by the SEO layer (canonical URL, OG/JSON-LD absolute URLs).
  site: "https://content.voila.dev",

  // On-demand rendering on Cloudflare Workers (build/deploy only).
  ...(isBuild
    ? {
        output: "server",
        adapter: cloudflare({ imageService: "compile" }),
      }
    : {}),

  // Self-hosted, optimized webfonts (no third-party requests at runtime).
  // Exposed as CSS variables consumed by styles/globals.css.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Geist",
      cssVariable: "--font-geist-sans",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Geist Mono",
      cssVariable: "--font-geist-mono",
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "SFMono-Regular", "monospace"],
    },
  ],

  // Phosphor icons, rendered inline at build via Iconify (@iconify-json/ph).
  integrations: [icon()],

  vite: {
    plugins: [tailwindcss()],
  },
});
