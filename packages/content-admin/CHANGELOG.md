# @voila/content-admin

## 0.2.1

### Patch Changes

- Republish of 0.2.0 with `workspace:` / `catalog:` dependency protocols resolved
  (0.2.0 was uninstallable and is deprecated). No code change.

## 0.2.0

### Minor Changes

- **Saved views, kanban & map** wired into the config-driven admin: the list
  screen loads/persists per-user views, dispatches on view type, and offers a
  `FilterBuilder`, kanban group-field and map geo-field pickers.
- **Geo map picker by default** — `defineAdmin` injects
  `createGeoInput({ mapStyleUrl })` into the edit registry (host `widgets.edit.geo`
  still overrides), so geo fields get a map picker out of the box.
- **Per-field save for grouped collections** — the detail screen edits grouped
  collections with `saveMode="field"` (each card patches its own field via the
  PATCH `update`) and stays in edit mode across saves, with an explicit Done.
- **Self-contained local-dev auth** — `createWorkerAdmin({ dev })` drops a pinned
  `VOILA_BASE_URL` in development so Better Auth infers the origin (and magic-link
  verify URLs) per request. Pass `dev: import.meta.env.DEV` from
  `app/lib/server.ts`; the production build keeps the pinned origin.
