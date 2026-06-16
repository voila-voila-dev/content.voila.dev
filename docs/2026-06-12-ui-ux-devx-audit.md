# UI / UX / DevX audit — create-voila end-to-end (2026-06-12)

**Method.** Scaffolded a real app with the actual CLI (`create-voila` →
`products/content.voila.dev/examples/demo`), ran `bun install`, `voila migrate
generate|apply`, booted `vite dev`, and drove the admin in Chrome (snapshot +
screenshot + network/console inspection): dashboard → list → create → detail →
edit → delete, plus mobile viewport, dark-mode emulation, and direct REST
probes. Three parallel code audits (content-ui, content engine, registry/CLI)
verified every browser finding against source. The patched, working repro lives
in `products/content.voila.dev/examples/demo` (its `vite.config.ts`,
`app/lib/server.ts` and the three `admin.posts.*` routes show every fix that
was needed to make the scaffold actually run).

**Verdict.** The engine (REST, Database, validation, envelopes) and the
content-ui components are solid once wired — CRUD, validation, conflict
handling, keyset paging and mobile sidebar all work. But **the out-of-box
scaffold does not boot, does not style, does not hydrate, and has no API and no
collection pages** — five independent blockers stand between `create-voila`
and the README's promise ("the admin list, detail, and create/edit forms update
automatically"). Two engine contracts are broken end-to-end (datetime writes,
singleton creation). Everything below is ordered by what to fix first.

---

## P0 — The scaffold is broken out of the box

Each of these was hit, in sequence, on a fresh scaffold. Any one of them kills
the first-run experience.

### 1. Install fails: version pin vs actual package version
`@voila/content-cli` is `0.0.0` (`packages/content-cli/package.json`) but the
template pins `^0.1.0` → bun can't link the workspace package, falls back to
npm (nothing is published) → **`bun install` dies with a 404**.
- [x] Bump `@voila/content-cli` to `0.1.0` (changesets) **and** add a CI check
      that template dependency ranges match workspace versions.
      (`create-voila/src/template-versions.test.ts` — runs in the root
      `bun test` CI gate; also asserts template-pinned workspace packages
      aren't `private`, since a private package 404s the same way once
      installs resolve from npm.)

### 2. Dev server doesn't boot: TanStack Start drift (`app/` + `createRouter`)
Current Start resolves entries from `src/` by default and requires a
`getRouter` export; the template uses `app/` with no `srcDirectory` option and
exports `createRouter` (`template/vite.config.ts`, `template/app/router.tsx`).
Result: first `vite dev` → *"Could not resolve entry for router"*; after fixing
the directory, every URL → *"Cannot GET /"*.
- [x] `tanstackStart({ srcDirectory: "app" })` in the template vite config.
- [x] Rename the export to `getRouter` and drop the stale `Register` module
      augmentation (the generated `routeTree.gen.ts` footer now declares it).
- [x] Pin `@tanstack/react-start` / `react-router` to a tested minor instead of
      `^1.0.0` — Start still ships breaking conventions in minors.
      (`~1.168.25` / `~1.170.15` — the pair verified booting in
      `examples/demo`; the registry's `TANSTACK_ROUTER` pin aligned too so
      `voila add` can't reintroduce the drift.)

### 3. Zero styling: Tailwind v4 is never processed
`app/styles.css` does `@import "@voila/ui/tailwind"`, but the template has no
`@tailwindcss/vite` plugin and no devDependency — the raw `@theme` CSS is
served untouched and **the whole admin renders unstyled Times New Roman**.
- [x] Add `@tailwindcss/vite` to template devDeps and `tailwindcss()` to the
      vite plugins.

### 4. No hydration: React Refresh runtime missing
Start dev mode hard-requires a React Refresh plugin; without it the client
entry 500s (*"requires the React Refresh runtime"*) and **the admin is dead
server HTML** — clicking Create performed a native GET submit. The error only
appears in the terminal; the page fails silently.
- [x] Add `@vitejs/plugin-react` (v5 line for vite 7 — the current v6 latest
      requires vite 8 / `vite/internal`) to template devDeps + plugins.
      (`^5.0.0` — caret stays inside the v5 line, so it can't float to the
      vite-8-only v6.)

### 5. The promise isn't shipped: no API mount, no collection pages
The typed client points at `/admin/api`, but nothing serves it; the sidebar
links to `/admin/posts` and `/admin/settings`, but no routes exist → **every
sidebar link is a 404 and every client call would be too**. ListView /
DetailView / CollectionForm exist in `@voila/content-ui` but nothing in the
template or registry uses them; the registry's only 3 items duplicate template
files. Per the established policy (one route file per endpoint — see memory of
2026-05), generate these rather than splatting.
- [x] Template (or `voila add`-vendable items): an `/admin/api` server route
      mounting `createRestHandler` (Start: `createFileRoute(...)({ server:
      { handlers } })`), per-collection `admin.<slug>.index/new/$id` pages
      over ListView/CollectionForm/DetailView, and a singleton settings page.
      *(Done minus the settings page: template ships `app/lib/server.ts`
      (node-sqlite driver → `makeDatabase` → `createRestHandler`), the
      `admin.api.$` mount, and `admin.posts.index/new/$id` over
      ListView/CollectionForm/DetailView (with working cursor load-more);
      `routeTree.gen.ts` regenerated to match. The settings page is blocked on
      #9 — singletons have no working write path and no client accessors — so
      it ships with #9, not as a page that can't save.)*
- [x] Until vended pages exist, the Dashboard/sidebar must not link to routes
      that don't exist (dead-link shell is worse than no shell).
      *(Done: the `settings` singleton is removed from the template
      `content.config.ts` (nav + dashboard derive from config, so the link
      disappears) with a comment pointing at #9; every remaining nav entry has
      a real route.)*

### 6. The local-dev database story contradicts itself (Bun vs Node)
`vite dev` runs SSR under **Node**, but the only bundled local driver is
`bun:sqlite` — and it's imported at module scope by the `@voila/content/server`
**barrel**, so merely importing `createRestHandler` under Node throws
`ERR_UNSUPPORTED_ESM_URL_SCHEME`. The CLI migrates `local.db` happily (it runs
under Bun), then the app it scaffolded cannot open it. The demo had to deep-
import internals and hand-roll a `node:sqlite` driver to proceed.
- [x] Move `makeSqliteDriver` out of the barrel (own subpath, e.g.
      `@voila/content/server/bun-sqlite`) so `./server` is runtime-neutral.
      *(Done: renamed `makeBunSqliteDriver` on `@voila/content/server/bun-sqlite`;
      the barrel keeps only the runtime-neutral `resolveSqliteUrl` +
      `SqliteDriver` types from the new `database/sqlite.ts`.)*
- [x] Ship a `node:sqlite` driver (Node ≥22.5) or make the sqlite driver
      runtime-detecting; the template's server wiring should work under plain
      `vite dev`.
      *(Done: `makeNodeSqliteDriver` on `@voila/content/server/node-sqlite`,
      resolving `node:sqlite` lazily via `process.getBuiltinModule` (Node
      ≥22.13 unflagged) with a descriptive error elsewhere. Verified end-to-end:
      `examples/demo` now imports only the public subpaths — deep-import hack
      deleted — and `/admin/api/posts` serves the CLI-migrated `local.db` under
      Node `vite dev`. Template wiring itself lands with #5's API mount.)*

### 7. README/CLI says port 3000; vite serves 5173
`printNextSteps` and the template README both say `http://localhost:3000`.
- [x] Say 5173, or set `server.port: 3000` in the template vite config.
      *(Done: pinned `server.port: 3000` in the template + examples/demo vite
      configs, matching TanStack Start convention; README/CLI URLs unchanged.)*

---

## P1 — Broken or misleading product behaviour (engine + UI)

### 8. Datetime fields cannot be written through the stack
Three layers disagree: the edit widget emits a `Date`
(`content-ui/src/widgets/edit.tsx:229`), the typed client JSON-serializes it to
an ISO string, and the schema accepts **only epoch ms or `Date`**
(`content/src/config/schema/fields/datetime.ts`) → every datetime write from
the admin 422s ("Expected epoch milliseconds or a Date"). Client-side
`validateFields` passes the very value the server rejects, breaking the
"same contract as the REST write path" claim.
- [x] Accept ISO-8601 strings in the datetime schema (coerce → epoch), or make
      the widget emit epoch ms. Add a round-trip test (form → client → REST →
      DB → form). _Done: schema accepts ISO-8601 strings; `dateInputValue` also
      displays the epoch-ms/ISO wire forms (reads return epoch ms, so existing
      values rendered blank); round-trip covered in
      `content/src/client/datetime-roundtrip.test.ts` + widget display tests._

### 9. Singletons cannot be created at all
`Database.create` always assigns `crypto.randomUUID()` while the DDL emits
`CHECK ("id" = '<slug>')` for singletons → POST on a singleton always violates
its own constraint and surfaces as an opaque `{"error":{"code":"INTERNAL"}}`.
There is no upsert/get-or-create, the typed client has **no singleton
accessors** (collections only), and GET returns a list envelope
`{data:[…],nextCursor}` for a conceptually single document. The template still
puts "Settings" in the nav.
- [x] Engine: singleton-aware write path (POST/PUT → upsert with `id = slug`).
      _Done 2026-06-12: `Database.create` uses the table's pinned singleton id
      (satisfies the DDL CHECK); new `Database.upsert` creates-or-patches the one
      row and revives a soft-deleted one._
- [x] Client: `client.settings.get()/set()` accessors.
      _Done 2026-06-12: `SingletonClient` (`get()` → `null` until first write,
      locale overload included; `set()` → PUT upsert) mapped into `ContentClient`
      from `config.singletons`._
- [x] REST: `GET /:singleton` → `{data:{…}}` (object, not list).
      _Done 2026-06-12: singleton slugs swap the root routes — GET serves the one
      document as an object envelope (404 until first set), PUT/POST upsert and
      guard as a CSRF-checked `update`._

### 10. Server errors are swallowed; clients see only "CODE (status)"
`runHandler` folds any exception to `INTERNAL` **without logging anything**
(`server/rest/handlers.ts` / `errors.ts:internalFailure` discards the cause) —
the singleton bug above produced zero terminal output. On the client,
`ContentClientError.message` is just `"VALIDATION (422)"` even though the
envelope carries `issues:[{path,message}]`; CollectionForm renders that opaque
string and nothing maps issues back to fields, so the user saw a bare
"VALIDATION (422)" screen while the actionable message existed in the payload.
- [x] Add `onError` hook to `RestHandlerOptions` (default: `console.error` in
      dev).
      _Done 2026-06-12: `RestErrorHook` fires only when a non-`ApiError` throw
      folds to `INTERNAL`; settable on `RestHandlerOptions`, `RestContext`, or
      `MediaContext` (context-level wins). Default logs via `console.error`
      unless `NODE_ENV === "production"`._
- [x] Include issue summaries in `ContentClientError.message`; expose a typed
      helper (`issuesByField()`).
      _Done 2026-06-12: message now carries VALIDATION issue paths+messages, the
      CONFLICT field, and FORBIDDEN denied fields; `issuesByField()` (method +
      standalone export) flattens those to `{ field: message }` for forms._
- [x] `CollectionForm`: accept `serverErrors?: Record<string,string>` (or take
      the `ApiFailure` directly) so 422/409 land on the offending field.
      CONFLICT should highlight its `field`, not just say "CONFLICT (409)".
      _Done 2026-06-12: new `serverErrors` prop (feed it
      `error.issuesByField()`); adopted as inline field errors that clear on
      edit, keys without a rendered field surface in the form-level slot._

### 11. `slug({ from: "title" })` is dead config
The option is stored in meta and used in the template's own example, but no
code reads it — not the edit widget (plain `TextInput`), not the form, not the
server. Typing a title produces an empty slug, which then stores `null`.
- [x] Implement derive-on-type (with manual-override latch) in the slug edit
      widget/CollectionForm, and/or derive server-side on create when absent.
      If neither: delete the option.
      (Both. Canonical `slugify` exported from `@voila/content` (diacritics
      stripped, output always matches the slug field's pattern).
      `CollectionForm` derives non-localized `slug({ from })` fields as the
      source is typed; hand-editing the slug — or editing an existing document
      — latches it off, and clearing it re-opens the latch. Server:
      `deriveSlugFields` in `rest/write.ts` fills an absent/`null`/`""` slug
      from its source on POST, before the field-access check, so a derived
      value passes the same RBAC + validation gates as a typed one.)

### 12. List/empty/loading and detail-page polish
Seen live:
- "No records." and "Loading…" render **simultaneously** (DataTable shows the
  empty message whenever `rows.length === 0`, regardless of `loading`).
- DetailView's heading is the **collection** label ("Posts"), not the
  document's title — there is no `titleField` concept anywhere.
- Dashboard stat cards render an em-dash forever (no count endpoint, no
  helper; template passes nothing).
- Boolean "Yes" badge is solid-primary — reads as a button, heavy for a value.
- [x] Pass `loading` into DataTable; suppress empty message while loading.
      *(Done: `DataTable` takes `loading` (+ `loadingMessage`) and shows it in
      place of `emptyMessage` while an empty list loads; `ListView` forwards
      its `loading` and only renders the separate Loading… note when rows are
      already on screen — the two messages can no longer coexist.)*
- [x] Add optional `titleField` to collection config; DetailView/breadcrumbs
      use `doc[titleField]`.
      *(Done: `defineCollection({ titleField })` — key checked against the
      declared fields at the authoring site, stored as `string` on
      `Collection` to keep `Fields` covariant. `DetailView` heads with
      `doc[titleField]` (exported `documentTitle` helper for future
      breadcrumbs), falling back to label/slug on blank/non-scalar values;
      template + demo set `titleField: "title"` so the post detail page now
      heads with the post's title. No breadcrumb component exists yet.)*
- [x] Either add a cheap count to `list` (`?count=1`) + dashboard wiring, or
      stop rendering count placeholders.
      *(Done — counted: `Database.list({ count: true })` runs one extra
      cursor-free `COUNT(*)` over the same soft-delete/draft scope; REST
      accepts `?count=1|0|true|false` (else 400) and adds `total` to the list
      envelope; the typed client passes `count` and surfaces `total` on
      `ListPage`. Template + demo dashboards fetch
      `list({ limit: 1, count: true, status: "any" })` per collection, so the
      stat cards show real numbers.)*
- [x] Boolean badge: `BooleanDisplay` now renders secondary (Yes) / outline
      (No) — no more solid-primary value badges.

### 13. Accessibility gaps (all confirmed via a11y snapshot)
- The Published `switch` has **no accessible name** (label not associated —
  `widgets/edit.tsx` BooleanInput + CollectionForm label markup; visually the
  label also touches the control with no gap).
- DataTable headers/cells expose no `columnheader`/`table` semantics in the
  a11y tree; clickable rows have no `role`/name announcing interactivity.
- Field-level validation errors are done well (`role=alert`, `aria-invalid`) —
  keep that bar.
- [x] Associate label ↔ switch (`htmlFor`/`aria-labelledby`) and fix spacing.
      *(Done: Base UI's Switch puts the `id` prop on its hidden checkbox, so
      `htmlFor` alone never named the visible `role="switch"` element —
      `EditWidgetProps` gained `labelId`, `CollectionForm` gives its `<Label>`
      an `${id}-label` id and passes it down, and `BooleanInput` sets
      `aria-labelledby`. `LocalizedFieldEditor` composes the form label + the
      locale badge ("Published en-US") per locale. A block wrapper in
      `BooleanInput` drops the inline-flex switch below the inline label so
      the form's `space-y-1.5` gap actually applies.)*
- [x] Use semantic table markup (or ARIA grid roles) in DataTable; give
      row-activation an accessible affordance (row link pattern).
      *(Done: the markup was already native `<table>/<th>/<td>` but Chrome's
      layout-table heuristic demoted it — DataTable now pins explicit
      `table`/`rowgroup`/`row`/`columnheader`/`cell` roles + `scope="col"`.
      Clickable rows swapped the bare `tabIndex`/keydown for the row-link
      pattern: a visually-hidden "Open <titleField value>" button in the first
      cell (native click/Enter/Space bubbles to the row's `onClick`), with
      `focus-within:bg-muted/50` as the visible focus affordance.)*

### 14. Dark mode exists in tokens but nothing can turn it on
`@voila/ui` ships `.dark` tokens; with OS dark-mode emulated, `<html>` gets no
class and the admin stays light. No toggle, no `prefers-color-scheme` hook.
- [x] Minimal: honor `prefers-color-scheme` in the template root; better: a
      shell-level theme toggle persisted to localStorage. *(Done: pre-paint
      `themeInitScript` inlined in the template/demo root honors localStorage
      then `prefers-color-scheme`; `ThemeToggle` in the `AdminShell` header
      persists the choice. Required two `@voila/ui` fixes uncovered along the
      way: class-based `@custom-variant dark` and `body { bg-background
      text-foreground }` in the base layer, plus a `@voila/content-ui/tailwind`
      `@source` entry so the package's classes are generated at all.)*

### 15. Markdown body is a 3-row plain textarea
`fields.markdown()` renders/edits as raw text (display even collapses
newlines into one line in DataTable/DetailView). The Plate-based
`@voila/rich-text-editor` package exists but is wired nowhere.
- [x] Short term: monospace textarea with sensible min-height + preserved
      line breaks in display widgets.
      *(Done: `MonospaceTextareaInput` (`min-h-40 font-mono`) is the default
      edit widget and `MultilineTextDisplay` (`whitespace-pre-wrap`) the
      default display widget for the `markdown` and `code` kinds; both
      exported for overrides.)*
- [ ] Longer term: registry item vending the Plate-based rich-text editor as
      the `markdown`/`richtext` edit widget.
      *(Plan written: `docs/2026-06-12-rich-text-widget-vending-plan.md`.)*

---

## P2 — Consistency & DRY (engine and packages)

### 16. Error envelope shape is inconsistent
`VALIDATION` carries `issues:[{path,message}]`, `CONFLICT` carries a bare
`field` (`server/rest/errors.ts`). Clients need two code paths for "which
field is wrong". Also note `docs`' envelope description mentions `message`
while the implementation has none (long-standing divergence — see memory).
- [x] Unify on `issues` for every field-addressable error; update the doc.
      _Done 2026-06-12: `CONFLICT` now carries `issues:[{path,message}]` (empty
      when the driver can't name the column) and field-level `FORBIDDEN` carries
      `issues` instead of bare `fields`; client `describeFailure`/`issuesByField`
      collapsed to one issues-driven path (`failureIssues`). Roadmap envelope
      description updated. The `message` divergence note referred to old pivot
      docs — no doc on `main` claims a top-level `message`._

### 17. Redact/localize pipeline copy-pasted ~18×
Every read/write/revision handler hand-rolls `requireCollection` →
`readAccessContext` → `redactDocument` → `localizeRow`
(`handlers.ts`, `write.ts`, `revisions.ts`). Forgetting one call = data leak.
- [x] Extract one `serializeRow(entry, row, principal, chain)` helper and use
      it everywhere a document leaves the API.

### 18. Route matching is 17 hand-rolled segment-count guards
`router.ts` matches collections, media and revisions with repeated
`segments.length === n && second === "x"` chains — brittle and hard to extend
(off-by-one falls through silently).
- [x] Data-driven route table (pattern → operation → handler), shared by the
      media/revisions sub-routers.
      *(Done: `router.ts` now declares `CONTENT_ROUTES` + `MEDIA_ROUTES` as
      tables of `(method, pattern, { operation, documentId?, when?, run })`
      rows over one shared matcher (`:name` captures, literals must equal,
      first match wins); param names are derived from the pattern literal at
      the type level, so `params.id` is a typo-checked `string`. Singleton
      root swaps are `when` predicates ordered above their collection rows.
      100% line coverage, behavior unchanged.)*

### 19. Template vs registry duplication (and divergence already)
The registry's only 3 items duplicate 3 template files, and `admin-layout`
has **already diverged** (registry copy uses plain `<a>`; template uses
TanStack `<Link>`). Running `voila add admin-shell` would downgrade a fresh
app.
- [x] Single source: template should consume the registry items (scaffold =
      `vendFiles` of a default item set), not maintain parallel copies.
      *(Done: the three duplicates are deleted from the template; the registry
      items were refreshed to the newer template content (TanStack `<Link>` —
      `admin-shell` now declares the `@tanstack/react-router` dep) and
      `scaffold()` vends `resolve(registry, DEFAULT_ITEMS)` on top of the
      template copy. Tests pin the contract: the template may not shadow a
      registry-owned file, and it must pin each plan dependency at the
      registry's exact range.)*
- [x] This also collapses the duplicated file-writing logic in
      `create-voila/scaffold.ts` vs `content-registry/vend.ts` (same
      read→transform→mkdir→write loop, one with `{{projectName}}`, one with
      overwrite/skip).
      *(Done: `vendFiles` grew optional `read`/`transform` options; the
      scaffold's template copy now goes through the same loop with a
      template-dir reader and a `{{projectName}}` transform.)*

### 20. `voila add` vends blindly into `--cwd`
No check that the target is a voila app (no `content.config.ts`/`package.json`
probe), so files can land anywhere silently; vended paths assume `app/` and
will miss `src/`-shaped apps.
- [x] Validate host shape before vending; resolve the routes dir from the
      host's vite config.
      *(Done: new `content-cli` `cli/host.ts` — `validateHost` requires
      `package.json` + `content.config.ts` at `--cwd` (clear CliError pointing
      at `bun create voila` otherwise), `resolveSrcDirectory` reads
      `srcDirectory` from the vite config (TanStack Start's `src` default when
      the plugin is configured without it, `src/routes` probe, then `app`),
      and `retargetFiles` remaps the authored `app/…` targets accordingly.
      Wired into both `voila add` (incl. dry-run) and `voila diff`.)*

### 21. Small DRY items (one PR of cleanups) — DONE (2026-06-12)
- [x] `field.meta.label ?? humanize(key)` repeated in DataTable, DetailView,
  CollectionForm, ListView → `getFieldLabel()` helper.
  *(`lib/humanize.ts`, exported; the ListView occurrence was the collection
  heading, not a field label — left as is.)*
- [x] Em-dash empty marker duplicated (`widgets/display.tsx` `Empty()`,
  `dashboard.tsx` `formatCount`) → export one `<Empty/>`.
- [x] `resolveDisplayWidget`/`resolveEditWidget` are the same fallback chain in
  two files → generic `resolveWidget`.
  *(`registry/resolve.ts`; both resolvers are now one-line wrappers and keep
  their public signatures.)*
- [x] `toPackageName` (create-voila) vs `slugify` (content-cli migrator) — same
  normalization, different separators → shared util (could also back the slug
  field derivation from #11).
  *(Both delegate to the canonical `slugify` from `@voila/content` (#11's):
  the migrator swaps `-`→`_` for filenames, `toPackageName` keeps its
  `voila-app` fallback. create-voila gained the `@voila/content` workspace
  dep — one tiny transitive dep, acceptable for the initializer.)*
- [x] `Record<string, unknown>` document casts repeated ~15× in content-ui → a
  `Doc` type alias.
  *(`lib/doc.ts`, exported; applied everywhere a document/values record is
  meant — the `app-sidebar.tsx` cast is element props, not a doc, and stays.)*
- [x] `voila migrate apply` defaults to `file:./local.db` but no template file or
  README mentions that name; the runtime wiring (once it exists, #5/#6) must
  default to the same path.
  *(Wiring already matches since #6 (`app/lib/server.ts` opens
  `file:./local.db` with a keep-in-sync comment); template + demo READMEs now
  name `./local.db`, and the content-cli README notes the `--db` default.)*

---

## Suggested execution order

| Step | Scope | Items |
|------|-------|-------|
| 1 | Make `create-voila` boot truthfully (template fixes + version pin + port) | #1–#4, #7 |
| 2 | Ship the wiring the README promises (API route + collection pages + node-safe sqlite) | #5, #6 |
| 3 | Fix the two broken engine contracts | #8 (datetime), #9 (singletons) |
| 4 | Error-path DX (onError, issue mapping into forms) | #10, #16 |
| 5 | Form/list polish + a11y + slug derivation | #11–#13 |
| 6 | Theme + markdown editing | #14, #15 |
| 7 | DRY/consistency sweep (engine serializer, router table, registry-as-source) | #17–#21 |

A regression gate worth adding once step 2 lands: a CI job that scaffolds into
a temp dir with `create-voila`, boots `vite dev` under **Node**, and drives
one create→edit→delete cycle (Playwright) — every P0 above would have been
caught by exactly that test.
