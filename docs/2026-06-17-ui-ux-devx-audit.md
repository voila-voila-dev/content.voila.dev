# UI / UX / DevX + code-consistency audit — content.voila.dev (2026-06-17)

**Scope.** A broad review pass: drove the scaffolded admin in a real browser
(Playwright), exercised auth, CRUD, the new rich-text editor (slash / mentions /
media), dark mode, mobile, and Storybook; ran three parallel source audits for
code consistency and DevX; applied every fix that was clearly safe and left the
gates green. This follows the [2026-06-12 create-voila audit](./2026-06-12-ui-ux-devx-audit.md)
and the [2026-06-13 status review](./2026-06-13-review-audit.md); auth-by-default
(2026-06-14) and the rich-text slash menu / mentions / media upload (commit
`67c4f23`) have landed since.

**Method.**
- Ran the gates: `bun test` (**985 pass / 0 fail**, 163 files), `tsc -b` (**clean**),
  coverage gates (**all PASS** — content-ui 100%, content-registry 100%).
- **Booted the real app** (`examples/demo`, `vite dev`, Node SSR over the
  CLI-migrated `local.db`) and drove the admin in Chrome via Playwright CLI:
  login (magic link) → dashboard → list → create → detail → edit → delete, plus
  the rich-text editor, dark-mode toggle, and a 390×844 mobile viewport.
- Booted **Storybook** (`apps/ui.voila.dev`, ~30 shadcn component stories).
- Three parallel source audits (engine; content-ui + rich-text-editor;
  CLI + registry + scaffold) cross-checked live behaviour against the code.

**Verdict.** The framework is in strong shape and most of CRUD works end to end:
auth (magic link + CSRF + first-user-wins RBAC), create, **edit**, delete,
datetime, keyset paging, dark mode, and the rich-text toolbar + slash menu all
function. The engine and component code remain clean (no TODO/FIXME in
production paths, high coverage, disciplined typed errors and router-agnostic
UI). **But this pass found one bug that silently broke every edit, and one DevX
trap that broke first-run auth whenever port 3000 is taken** — both common
enough that a new user would hit them. Both are now fixed and verified live
(gates green: 986 tests, tsc, coverage).

---

## Fixes applied this pass (gates green: 986 tests, tsc, coverage)

1. **`localized-field`: editing any document with a localized field silently
   failed to save (P1 — fixed & verified live).** See P1.1 below.
   `LocalizedFieldEditor` now emits a functional updater and
   `CollectionForm.handleChange` resolves it, so concurrent per-locale edits
   merge against the latest record instead of clobbering each other.
   (`content-ui/src/localized-field.tsx`, `collection-form.tsx`, test updated.)
2. **Auth broke on any port other than 3000 (P1 — fixed & verified live).** See
   P1.2 below. The Better Auth bridge no longer hard-pins `baseURL` in dev: with
   no explicit `baseUrl` it uses Better Auth's dynamic base-URL config
   (`allowedHosts` for localhost on any port) so the magic-link URL and the
   origin/CSRF check follow the actual port. The demo/template stop defaulting
   `VOILA_BASE_URL` to `http://localhost:3000` (it's now a production-only env
   var). (`content/.../better-auth/instance.ts`, demo + template `server.ts`,
   `dot-env`/`dot-env.example`, regression test added.)
2. **README sign-in would fail: `voila migrate generate` omitted `--auth`.**
   Both the template and demo READMEs showed the bare command (which does *not*
   create the `user`/`session` tables) while the comment claimed "+ auth
   tables". Added `--auth`. (`create-voila/template/README.md`,
   `examples/demo/README.md`.)
3. **`create-voila` next-steps never mentioned the login wall.** The terminal
   output now tells the user the admin is secure-by-default, that they'll land
   on `/admin/login`, and to open the magic link printed to the terminal.
   (`create-voila/src/index.ts`.)
4. **Convention: arrow-const top-level functions → function declarations.**
   `encodeCursor`/`decodeCursor`/helpers in `database/cursor.ts` and
   `generateDDL` in `content-cli/.../generate-ddl.ts` — the codebase's stated
   preference is `function foo() {}`.

---

## P1 — would block a new user

### 1.1 Editing a document with a localized field silently failed to save — FIXED
**Repro (demo config, which ships `summary: richText({ localized: true })`):**
create a post → open it → **Edit** → **Save**. No network request fired; both
`Summary en-US` and `Summary fr-FR` lit up `aria-invalid` with the alert
**"Expected an array"**, and the edit was lost. Create worked (the empty
optional field was omitted); only *edit* broke, so a user could create content
but never change it.

**Root cause.** A localized field's value is `Record<locale, T>`, narrowed by
`defineConfig` to *all* project locales required. On edit, the two per-locale
rich-text editors each normalise an empty document on mount and emit
`onChange`. `LocalizedFieldEditor` merged each as `{ ...record, [locale]: v }`
where `record` was captured at render — a stale closure. When both locales
emitted in one batch they overwrote each other against the same stale `{}`, so
the final record was missing a locale → `arrayOf` validator → "Expected an
array" (`config/schema/std/builders.ts:67`).

**Fix & verification.** Emit a functional updater so the host merges against the
latest record. After the fix, `PATCH /admin/api/posts/:id → 200`, the title
persisted, and `summary` stored as `{"en-US":[…],"fr-FR":[…]}` with **both**
locales intact (previously one was dropped). 985 tests + tsc + coverage green.

### 1.2 Auth broke on any port other than 3000 — FIXED
**Repro (before).** Start the demo while something else holds port 3000 (e.g.
another dev server — extremely common). Vite falls back to 3001. Sign-in then
failed: `POST /admin/api/auth/sign-in/magic-link → 403`, with the server logging
`[Better Auth]: Invalid origin: http://localhost:3001`. When a link *was*
generated it pointed at `http://localhost:3000/...` (the wrong port), so
verification bounced to whatever app owned 3000.

**Root cause.** `examples/demo/app/lib/server.ts` hard-coded
`baseUrl = process.env.VOILA_BASE_URL ?? "http://localhost:3000"` (and the
template `.env` set `VOILA_BASE_URL=http://localhost:3000`). Better Auth derives
both the magic-link URL and the trusted origin from that `baseURL`; the actual
listen port was never consulted.

**Fix.** `makeBetterAuth` now treats `baseUrl` as production-only. When it's
unset (dev), the bridge uses Better Auth 1.6's **dynamic base-URL config** —
`baseURL: { allowedHosts: ["localhost", "localhost:*", "127.0.0.1",
"127.0.0.1:*"], fallback }` — so Better Auth resolves the origin per request
from the (allow-listed) host. It also adds `trustedOrigins: ["http://localhost:*",
…]` so the write-path origin/CSRF check accepts the non-default port. The
demo/template `server.ts` pass `process.env.VOILA_BASE_URL` straight through
(undefined in dev), and `VOILA_BASE_URL` is commented out of the dev `.env`
(documented as a production setting).

**Verified live.** Booted the demo on **port 4567** with no `VOILA_BASE_URL`:
sign-in returned 200 (no "Invalid origin"), the magic link pointed at
`http://localhost:4567/...`, verification landed on `4567/admin`, and the
dashboard rendered signed-in. A regression test
(`auth.test.ts` — "infers the request origin when no baseUrl is pinned")
asserts both the 200 and the port-correct verify URL. Production is unchanged:
an explicit `baseUrl` still pins `baseURL` and locks origins to it.

*Still open (minor):* the login form shows "Check your inbox" optimistically
even if the sign-in request fails — worth surfacing the real error.

---

## P2 — rough edges a user will notice

- **A denied (non-admin) user sees an infinite "Loading…".** A second account
  (correctly denied by `firstUserAccess`) gets `403` on `GET …/posts` and
  `…/posts?count=1`, but `ListView` / the dashboard stat just spin "Loading…"
  forever with no "you don't have access" message. `ListView` should surface a
  403/error state. (Observed live; ties to the engine envelope being
  `code`-only — see P3.)
- **The `media` field has no edit widget.** The create/edit form renders
  *"No editor for "media" yet"* for `coverImage: fields.media()` — which the
  demo config features prominently. Images can only be added inline via the
  rich-text "Insert image" button, not as a first-class media field. Either ship
  a media edit widget or drop `coverImage` from the demo until one exists.
- **React hydration mismatch on every admin page.** Console logs *"A tree
  hydrated but some attributes … didn't match"* pointing at the sidebar
  `MenuButton isActive={true}` (`@voila/ui` AppSidebar / NavGroup) — the active
  link is computed differently SSR vs client. Resolve `currentPath` consistently
  on the server, or gate the active state behind a mounted flag.
- **Delete has no confirmation.** Clicking **Delete** on the detail page fires
  `client.posts.delete(id)` immediately and navigates away — one click, no
  "are you sure?", and no restore UI (it's a soft delete, so the data is
  recoverable only via the API). Add a confirm dialog (the `@voila/ui`
  AlertDialog exists) and/or an undo affordance.

## P3 — polish / consistency

- **Wide tables overflow on mobile.** The 8-column posts `DataTable` runs off a
  390px viewport with no visible horizontal-scroll affordance. The mobile
  sidebar collapse itself works.
- **`/favicon.ico` 404s on every page** (console noise). Ship a favicon in the
  template `public/` or add a `<link rel="icon">`.
- **An already-signed-in user can still open `/admin/login`** (no redirect to
  `/admin`). Minor.
- **Opening+saving a post "dirties" an empty optional localized field** with
  empty paragraphs (`{en-US:[{p:""}],…}`) instead of leaving it null. Cosmetic
  after the P1.1 fix; consider omitting all-empty localized records on write.

---

## Code-consistency / DevX audit (three source passes)

Verified against source; the clearly-safe ones are already fixed above. The
rest are recommendations.

### Engine (`@voila/content`)
- **Wire error envelope carries no `message`** (`server/rest/errors.ts`) — only
  `code` + typed metadata; `ContentClientError` reconstructs a message
  client-side, so a direct (curl/non-JS) caller gets only a code. This is also
  why the denied-read UX above has nothing human-readable to show. Add `message`
  to the envelope, or document that it's client-reconstructed only.
- **Malformed media list cursor throws a raw `Error`** (`server/media/store.ts`)
  → escapes `runHandler` as a **500**, whereas the collection read path returns
  a typed `400 INVALID_CURSOR` (`server/rest/query.ts`). No REST test pins the
  media path, but a unit test pins the throw. Translate to `INVALID_CURSOR` (or
  ignore like `database.ts` does) — a small cross-layer contract decision, so
  left for you rather than rushed.
- `makeClient(config, opts)` vs `makeMediaClient(opts)` signature asymmetry;
  `badRequest(details)` takes ad-hoc untyped detail objects; the Resend mailer
  swallows the error body on failure; the S3 presign TTL is hard-coded at 300s
  with no override; `config.collections as Record<…>` cast repeated 4× in
  `rest/handlers.ts`. All low-severity consistency nits.

### content-ui & rich-text-editor
- **`RichTextEditor` is effectively uncontrolled** — `value` changes after mount
  are ignored (Plate owns state). Fine *because* the form remounts per document,
  but the controlled-looking `onChange` API is a trap; document it as
  initial-only.
- **`LocalizedFieldEditor` renders the same `error` under every locale** — a
  failure on `fr` lights up `en` too. (Mitigated in practice now that P1.1 stops
  the spurious error, but the per-locale error plumbing is still missing.)
- **Rich-text media upload fails silently** when the host omits `onError`
  (`media.tsx`): the placeholder vanishes with no in-editor error. Mentions /
  slash comboboxes have no loading/async-empty state; an inserted `mention` node
  has no `role`/`aria-label`; uploaded images default to empty `alt`.
- **`SelectInput` hand-rolls a native `<select>`** with a long inline class
  string instead of the `@voila/ui` Select primitive the other widgets use.
- *Notably clean:* zero `[--var]` Tailwind-v4 violations, content-ui stays
  strictly router-agnostic, toolbar a11y (`role="toolbar"`, `aria-pressed`,
  selection-preserving `mousedown`) is exemplary, no dead code.

### Slash menu / mentions (live)
The slash menu **opens correctly** with proper a11y roles
(`combobox "Insert block"` → `listbox` → `option`). Driving item-*application*
via synthetic keystrokes was unreliable (a known Playwright↔Slate
contenteditable limitation — plain text insertion was itself intermittent), so
selection-applies-the-block could not be confirmed by automation and **should be
verified manually**. Not labelled a bug.

### CLI / registry / scaffold
- `voila <cmd> --help` is advertised (`cli/index.ts`) but **throws**
  `Unknown option '--help'` (strict `parseArgs` with no `help` option). Add a
  `help` flag per subcommand or stop advertising it.
- `voila add --overwrite` clobbers vended files with no confirmation or diff,
  even though `diffFiles` exists — risk of silently losing local edits.
- The demo still ships a **dead `settings` nav link** (singleton with no
  `admin.settings.*` route → 404 in-shell); and `template/content.config.ts` has
  a stale "singleton write path is still in flight" comment (it shipped).
- *Verified good:* `firstUserAccess` is secure and correctly memoized; template
  version pins, CSRF issuance/mirroring, the `/admin` guard, and per-app secret
  generation are all correct.

---

## Suggested next steps (priority order)
1. **Ship a `media` edit widget** (or remove `coverImage` from the demo).
2. **Fix the admin hydration mismatch** (sidebar active link).
3. **Add a delete confirmation** + per-locale form errors; surface the sign-in
   error in the login form (instead of always showing "Check your inbox").
4. Translate the media-cursor error to `400`; add `message` to the wire
   envelope; add `--help` to the CLI; gate `voila add --overwrite` behind a diff.

*Resolved this pass: the localized-edit P1 (1.1) and the auth-on-non-default-port
P1 (1.2), both fixed and verified live.*
