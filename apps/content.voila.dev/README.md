# content.voila.dev

The marketing / docs site for **content.voila.dev**, built with Astro and deployed
to Cloudflare Workers. Part of the `content.voila.dev` Bun workspace (`apps/*`).

## Stack

- **Astro 7** — SSR (`output: 'server'`) via the `@astrojs/cloudflare` adapter
- **Cloudflare Workers** — `wrangler.jsonc` (Static Assets + SSR worker)
- **Tailwind CSS v4** — `@tailwindcss/vite`, shadcn/ui-style tokens in `src/styles/globals.css`
- **Fonts** — Geist + Geist Mono, self-hosted via the Astro Fonts API (`astro.config.mjs`)
- **SEO** — `src/layouts/Layout.astro` + `src/components/Head.astro` (Open Graph,
  Twitter, canonical, robots) with JSON-LD typed by [`google/schema-dts`](https://github.com/google/schema-dts) (`src/lib/seo.ts`)
- **UI kit** — cva-driven primitives in `src/components/ui/` + marketing blocks in
  `src/components/blocks/`; pages are composition only
- **Icons** — Phosphor via `astro-icon` + `@iconify-json/ph`, rendered inline at build
  (semantic `<Icon name="…" />` wrapper in `src/components/ui/icon.astro`)
- **Styling utils** — `cva`, `tailwind-merge`, `clsx` (`cn` in `src/lib/utils.ts`)

## Commands

Run from this directory (or via `bun --filter @voila/content.voila.dev <script>` from the repo root):

| Command                  | Action                                             |
| :----------------------- | :------------------------------------------------- |
| `bun run dev`            | Start the dev server                               |
| `bun run build`          | Build to `./dist/` (SSR worker + static assets)    |
| `bun run preview`        | Preview the production build locally               |
| `bun run check`          | Type-check `.astro` files (`astro check`)          |
| `bun run deploy`         | Build + `wrangler deploy` (production)             |
| `bun run deploy:preview` | Build + `wrangler versions upload` (preview)       |

## Deployment

CI deploys via GitHub Actions: `.github/workflows/preview.yml` uploads a preview
Worker version on every PR touching this app (and comments the URL); `deploy.yml`
deploys to production on push to `main`. Both need the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets.

> Replace `public/og.png` with a real Open Graph image (referenced by `SITE.image`
> in `src/lib/seo.ts`).
