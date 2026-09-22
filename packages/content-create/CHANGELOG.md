# create-content-voila

## 0.1.5

### Patch Changes

- Updated dependencies [[`b288b94`](https://github.com/voila-voila-dev/content.voila.dev/commit/b288b94f92cfb9050c3272fe022fb231ea9fb19e), [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1), [`0b0e6be`](https://github.com/voila-voila-dev/content.voila.dev/commit/0b0e6bea1a30d9399fd40e49eb0d603377810ee0)]:
  - @voila/content@0.4.0

## 0.1.4

### Patch Changes

- Republish of 0.1.3 with the `workspace:` dependency protocol resolved (0.1.3
  was uninstallable and is deprecated). No code change.

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
