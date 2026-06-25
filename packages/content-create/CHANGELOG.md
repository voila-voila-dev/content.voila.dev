# create-content-voila

## 0.1.3

### Patch Changes

- The scaffold template now targets the `@voila/content@0.2.0` suite and ships
  `maplibre-gl` (+ its stylesheet in `__root.tsx`) so geo fields and map views
  work out of the box.
- **`vite dev` SSR fix** — the template `vite.config.ts` pre-bundles
  `use-sync-external-store` for the workerd SSR environment, fixing the
  `module is not defined` 500 a fresh project hit on its first `vite dev`.
- **Local-dev auth** — `app/lib/server.ts` passes `dev: import.meta.env.DEV` to
  `createWorkerAdmin`, so magic-link sign-in targets the local origin in dev while
  the production build still pins `VOILA_BASE_URL`.
