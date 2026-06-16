# Status review & audit — content.voila.dev (2026-06-13)

**Scope.** A full-project review of UX / UI / DevX, whether it actually works,
and what to improve next. This is the follow-up to the
[2026-06-12 create-voila end-to-end audit](./2026-06-12-ui-ux-devx-audit.md),
whose 21 findings are now almost entirely fixed. This pass re-validates that
the fixes hold, boots the app for real, and looks for what's *next* rather than
what's broken.

**Method.**
- Read the roadmap, the prior audit, and the four packages
  (`@voila/content`, `content-ui`, `content-cli`, `content-registry`,
  `create-voila`) plus the `examples/demo` repro.
- Ran the gates: `bun test` (**817 pass / 0 fail**, 144 files, 3.5s),
  `tsc -b` (**clean**), and the coverage gates (**all PASS**: content 90% on
  `config/schema` at 98.9%, content-ui 100%, content-registry 100%).
- **Booted the real app.** Started `vite dev` (Node SSR) against the
  CLI-migrated `examples/demo/local.db` and drove it over HTTP:
  `GET /admin` → 200, `GET /` → 200, `GET /admin/posts` → 200,
  `GET /admin/api/posts` → real JSON rows, singleton GET → 404-until-first-write
  (as designed), and a write probe.
- Three parallel source audits (engine, content-ui, CLI/registry/scaffold)
  cross-checked the live behaviour against the code.

---

## Verdict

**The engine is in excellent shape and the scaffold now boots and works.**
Every P0 from the 2026-06-12 audit is genuinely fixed: a fresh app styles,
hydrates, serves its API, and renders list/detail/create/edit over the typed
client. The codebase is clean — no `TODO`/`FIXME`/`not implemented` in any
production path, no `as any` outside intentional type-assertion tests, strong
typed-error discipline, and unusually high coverage for a project this size.
Phases 0–4 are done and Phase 5 is ~70% done (media, transforms, i18n,
drafts/scheduling, revisions, per-field RBAC all shipped and tested).

**The one finding that rises to the level of "must fix before anyone ships this":
the scaffolded admin has no authentication and no CSRF — the entire content API
is world-readable and world-writable out of the box.** The secure primitives
exist in the engine (Better Auth bridge, signed double-submit CSRF, RBAC) but
the template wires none of them and ships no login page. Everything else below
is polish or planned feature work.

---

## What works (validated live, not just claimed)

| Area | Evidence |
|------|----------|
| Scaffold boots under Node `vite dev` | server up in ~1s, `/admin` → 200 |
| Tailwind v4 styling processed | `@tailwindcss/vite` in template + demo vite config |
| Hydration | `@vitejs/plugin-react` (v5) present; admin is interactive, not dead HTML |
| REST API mounted & serving | `GET /admin/api/posts` returns real keyset-paginated rows |
| Node-safe sqlite | `makeNodeSqliteDriver` opens the CLI-migrated `local.db` under Node |
| CRUD + validation + conflict + paging | covered by 817 tests, exercised live |
| Datetime round-trip (prior #8) | schema accepts ISO-8601; round-trip test present |
| Singleton write path (prior #9) | `upsert` + `SingletonClient`; GET returns object/404 |
| Drafts / scheduling / revisions / i18n / media / per-field RBAC | shipped + tested |
| Gates | 817 tests, tsc clean, coverage 90–100% across packages |

The 2026-06-12 fixes are real and they hold.

### Playwright browser walkthrough (real Chromium, not just HTTP)

Drove the demo admin in a real browser via `playwright-cli` against
`vite dev`. Every step below was observed in the live a11y snapshot:

| Step | Result |
|------|--------|
| `/admin` dashboard | renders in-shell; only console error is a harmless `favicon.ico` 404 |
| Dashboard stat card count | flashes `Posts —` on SSR, hydrates to `Posts 2` (count works; **no SSR prefetch** — minor) |
| `/admin/posts` list | native `table`/`rowgroup`/`columnheader`/`cell` roles + row-link `Open <title>` button — a11y pattern confirmed live |
| New-post form | all fields render; `Title*` required-marked |
| **Slug derive-on-type** (#11) | typed `Playwright Smoke Test!` → slug auto-filled `playwright-smoke-test` ✓ |
| Create submit | persisted, redirected to detail at `/admin/posts/<uuid>` ✓ |
| Detail view (#12 titleField) | heading is the doc title **"Playwright Smoke Test!"**, not "Posts" ✓; definition-list term/definition semantics; empty fields show `—` |
| **Dark mode** (#14) | toggle adds `<html class="dark">`, persists to `localStorage["voila-theme"]` ✓ |
| **Form validation** | empty submit → Title `[invalid]` (`aria-invalid`) + `role="alert"` reading **"Required."** ✓ |
| **Settings nav link** (P1.1) | clicking it lands on `/admin/settings` and renders a bare `<p>Not Found</p>` **inside the shell** — confirms both the dead link and the missing `notFoundComponent` (P1.4) live |

So the happy-path CRUD UX is genuinely good in a browser. The two visible
rough edges — the dead **Settings** link rendering a generic "Not Found", and
the dashboard count flashing an em-dash before hydration — are exactly the
P1.1 / P1.4 / SSR-prefetch items below. (The walkthrough also re-confirmed P0:
the create succeeded with **no login anywhere in the flow**.)

---

## Findings, by severity

### 🔴 P0 — Security: the out-of-box admin is completely open

**The scaffolded REST mount has neither auth nor CSRF.** Both the template and
the demo wire the handler as:

```ts
// create-voila/template/app/lib/server.ts
export const restHandler = createRestHandler(
  { config, database },
  { basePath: "/admin/api" },
);   // ← no `auth`, no `csrf`, no `accessControl`
```

The engine guard is explicit that these seams are optional —
`auth/guard.ts:2`: *"omit `auth` and the API is open; omit `csrf` and writes
aren't [protected]."* Confirmed live: a bare

```
POST /admin/api/posts  {"data":{"title":"x","slug":"y"}}
```

with **no cookie and no CSRF token returned `201 Created`** and persisted the
row. Anyone who can reach the URL can read, create, edit, and delete all
content, and there is no login page anywhere in the scaffold.

This is the single largest gap between the product's promise (a real CMS admin)
and what `create-voila` ships. The pieces all exist — `@voila/content/better-auth`
(`makeBetterAuth` → `Authenticator` + magic-link over a `Mailer` seam), the
signed double-submit `CSRF`, the `AccessControl` RBAC hook, and
`voila migrate generate --auth` for the auth tables — they are simply not
assembled into the default app.

**Recommended:**
1. Scaffold an authenticated admin by default: wire `makeBetterAuth` into
   `server.ts`, pass `auth` + `csrf` (+ a generated `secret` in `.env`) to
   `createRestHandler`, generate auth tables with `--auth`, and ship a
   `/admin/login` magic-link page + a session guard on `/admin/*`.
2. If a zero-auth dev mode is intentional, make it **loud** — a console warning
   on every unauthenticated mount and a banner in the admin shell ("⚠ No auth
   configured — this admin is public"), plus a one-line opt-in to turn auth on.
3. Document the threat model in `dx.md`: today the README implies a finished
   admin; a reader will reasonably assume it's protected.

This is the right next milestone regardless of the rest of Phase 5.

---

### 🟠 P1 — Working but incomplete / misleading

**1. Singleton has a write path and a client, but still no scaffolded page —
and the demo ships a dead nav link.** The demo's `content.config.ts` registers a
`settings` singleton (`examples/demo/content.config.ts:20–30`); nav derives from
config, so the sidebar shows **Settings**, but there is no `admin.settings.*`
route — `GET /admin/settings` → **404** live. The template sidestepped this in
2026-06-12 by *removing* settings from its config, but the "patched working
repro" reintroduced it without a page. The engine work (#9) is done; the
**vended singleton page** is the missing last mile. Add an `admin.<singleton>`
route (over a `SingletonForm`/`DetailView`) to the registry and scaffold, or
remove settings from the demo config until it exists.

**2. Half the field kinds have no edit widget.** `content-ui` falls back to a
disabled `UnsupportedInput` for **relation, polymorphic, array, object, json,
media, richText** (`widgets/edit.tsx`, `registry/edit.ts:38`). Display side
falls back to `JsonDisplay` for the same set. So a config using anything past
the scalar kinds renders un-editable fields in the generated admin. Today's
working set is: string/slug/id/color, code/markdown (monospace textarea),
number/position, boolean, date/datetime/time, select/enum. This is fine for the
"afternoon test" blog, but it's the gap between "demo" and "serious CMS" that
the roadmap's Phase 5 exit criterion implies. Prioritise **media** (a picker
over the already-shipped `_media` routes) and **richText** (the Plate vending
plan in `docs/2026-06-12-rich-text-widget-vending-plan.md`), then array/object.

**3. Rich-text is still a plain textarea.** `@voila/rich-text-editor` (Plate)
exists but is wired nowhere; `markdown`/`richText` edit as a monospace textarea
(`widgets/edit.tsx:77-80` flags it as a stand-in). Plan exists, no code yet.

**4. `notFoundComponent` not configured.** Live, hitting `/admin/settings`
logged: *"A notFoundError was encountered on the route '/admin', but a
notFoundComponent option was not configured."* The scaffold should set a router
-level `defaultNotFoundComponent` so 404s inside the admin render in-shell
instead of TanStack's generic `<p>Not Found</p>`.

---

### 🟡 P2 — UX / UI / Accessibility polish

- **`DetailView` has no loading/error states** — it's purely presentational
  while `ListView`/`RevisionHistory` handle both. A host fetching a single doc
  has nowhere to show "loading" or a fetch error.
- **No live-region announcements** for list loading/empty transitions
  (`DataTable`/`ListView`). Sighted users see "Loading…"; AT users get silence.
  `role="alert"` is used well for *form* errors — extend the same care to state
  changes (`aria-live="polite"`).
- **No skeleton/placeholder states** in `DataTable`/`ListView` — perceived
  performance on first paint.
- **Dashboard counts aren't SSR-prefetched** — confirmed live: stat cards
  render `Posts —` server-side and only resolve to `Posts 2` after the client
  count fetch, so the admin home flashes an em-dash on every load. Prefetch the
  counts in the route loader (the typed client already supports
  `list({ count: true })`).
- **No focus management** after submit/navigation in `CollectionForm`/
  `DetailView` (no focus restore, no heading focus on route change).
- **Landmark roles**: `AdminShell` header isn't `role="banner"`; section
  wrappers lack consistent `<h1>`/region structure.
- **No dialog/confirmation primitive** in `content-ui` — destructive actions
  (delete) have no built-in confirm; labelling is left to the host.
- The strong a11y work from 2026-06-12 holds: DataTable explicit table roles,
  row-link pattern, switch `aria-labelledby`, form `aria-invalid`/`role=alert`.
  This bar is good — the gaps above are the remaining ~20%.

---

### 🟢 P3 — Engine code quality (minor, no blockers)

- **S3 storage throws bare strings on non-2xx** (`server/storage/s3.ts` ~156–171):
  a 4xx (auth/rate-limit) collapses into a generic message with no structured
  type. Wrap in a `StorageError` carrying status/key.
- **Unique-conflict detection is regex/substring over driver error text**
  (`database.ts` ~203–211). Works for current SQLite/Postgres; brittle if a
  driver's message wording drifts. Low risk, worth a comment + test pinning the
  strings.
- **fs storage path-escape check is post-resolution** (`storage/fs.ts:19`) — a
  `startsWith(root)` guard that a symlink could in principle defeat. Not a
  realistic attack on engine-controlled keys; document the assumption.
- **`router.ts` and `errors.ts` have no direct unit test** — both are heavily
  exercised transitively (every handler test routes through them), so coverage
  is high, but the route-matcher in particular would benefit from a focused test
  given how central it is.
- Long files (`database.ts` 712, `router.ts` 389) are long but cohesive — not a
  concern.

---

## Phase 5 — what's left

Shipped & tested: **media** (Storage seam + memory/fs/R2/S3 adapters, `_media`
routes, `makeMediaClient`), **image transforms** (`ImageCdn` URL seam),
**i18n delivery** (`?locale=` + fallback graph + localized client overloads +
`LocalizedFieldEditor`), **drafts/scheduled publishing** (query-time go-live, no
cron), **version history** (`voila_revisions`, restore), **per-field RBAC**
(read-redaction + write-403 at the REST boundary).

Not started (confirmed absent in source):

| Feature | Notes |
|---------|-------|
| **Search** (D1 FTS5 / Postgres FTS) | no search routes or indexes |
| **Audit log** | no `voila_audit` table or logging seam |
| **Import / export** (JSON/CSV) | no bulk routes |
| **Webhooks / background tasks / cron** | publish scheduling is query-time only; no "went-live" event emitter |
| **Live preview** (CF Durable Object) | not started |
| **MCP server over the config** | not started — and a natural fit given the config is already fully typed/introspectable |
| **CLI `seed` / `doctor`** | roadmap Phase 1 leftovers; `doctor` would be a great place to *detect the no-auth mount* from P0 |

---

## Recommended order of work

1. **Auth by default** (P0). Wire Better Auth + CSRF + RBAC into the scaffold,
   ship a login page and an `/admin/*` session guard, generate auth tables.
   Until then, make the open mount loud. *This is the headline item.*
2. **Close the singleton last mile** (P1.1): vended singleton page + fix the
   demo's dead Settings link; add `defaultNotFoundComponent` (P1.4).
3. **Edit widgets for the non-scalar kinds** (P1.2), prioritising **media**
   (picker over existing `_media` routes) and **richText** (execute the Plate
   vending plan), then array/object/relation.
4. **UX/a11y polish sweep** (P2): DetailView states, live regions, focus
   management, a confirm dialog primitive.
5. **Pick the next Phase 5 capability.** Strongest candidates by leverage:
   **MCP server** (the typed config makes it nearly free and it's on-brand for
   the AI-agent story) and **search** (table stakes for "serious CMS").
6. **Land the CI regression gate the prior audit recommended**: scaffold into a
   temp dir, boot `vite dev` under Node, drive one create→edit→delete cycle.
   This pass had to boot the app by hand to find the auth gap — that test would
   institutionalise the "does it actually run?" check (and could assert the
   secure-by-default mount once #1 lands).

---

## One-line summary

Engine and tooling are production-grade and the scaffold finally boots and works
end-to-end — but it ships a **wide-open, unauthenticated admin**, and the
"serious CMS" finish line still needs auth-by-default, the non-scalar edit
widgets, the singleton page, and the remaining Phase-5 features (search, audit,
import/export, webhooks, live preview, MCP).
