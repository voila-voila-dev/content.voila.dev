# Admin navigation refactor + polish audit (2026-09-09)

Scope: `@voila/content-ui`, `@voila/content-admin`, `apps/demo.content.voila.dev`.
Method: code inventory of both repos + a browser walk of the demo (`vite dev`, seeded sandbox, light + dark) through dashboard, list, detail, edit, new, board/calendar/map views, settings, login.
Reference model: `apps/app.tries.care` shell (`shared/components/app-shell/*`, `page-layout.tsx`, `admin-list.tsx`).

Severity: **P0** = broken/incorrect data shown, **P1** = clearly wrong UX, **P2** = polish.

---

## 1. Navigation refactor (target = tries.care desktop shell)

### How tries.care does it (what to copy)
- One `AppShell` = `Sidebar.Provider` → `Sidebar.Root variant="inset" collapsible="icon"` → Header (workspace switcher + ⌘K search link) / Content / Footer (avatar link) + `Sidebar.Inset` with `md:h-[calc(100dvh-1rem)]`.
- **One nav surface at a time.** Top level = `NavigationTree` (icon + label + trailing caret for areas). Inside an entity = `SectionSidebar`: back row (`‹ Users`), separator, `GroupLabel` = entity title, then one exact-match item per section, each with icon + optional badge. Registered from the entity layout route via `useRegisterSidebarSection(section | null)`.
- Routes: `admin.users.$id.tsx` (layout: loads entity, registers section) + `admin.users.$id.{index,general,security}.tsx`. Sections are routes, not query params.
- Page chrome: single `h-14` header bar = `Sidebar.Trigger` + back link + `h1 text-base font-semibold` + actions; body = `ScrollArea` with `py-6` and a `BodyWidth` token (narrow 2xl / reading 3xl / content 4xl / full). Entity pages keep an `EntityHeader` identity card above the section outlet. No breadcrumbs anywhere.
- Mobile (<768) = `DockShell` bottom tab bar; entity sections become `PageTabs` under the header.
- Menu button styling comes from the kit (`h-8 rounded-md p-2 text-sm gap-2`, `data-active:bg-sidebar-accent font-medium`, `Menu gap-1`, collapsed rail tooltips, ⌘B toggle).

### Gaps in content-admin today
| # | Sev | Item | Where |
|---|-----|------|-------|
| N1 | P1 | Two stacked header bars on every screen: `AdminShell` bar (trigger + "Demo" span + theme toggle) **and** `PageLayout.Header` (h1 + actions). Merge into one `h-14` bar: trigger · back · title · actions · theme. | `content-ui/src/admin-shell.tsx`, `page-layout.tsx` |
| N2 | P1 | Detail sub-navigation is an inner "Sections" rail (`FieldGroupNav`, `?group=` query param). Move it into the sidebar (swap content for back row + doc title + sections) and make sections routes (`$collection.$id.tsx` layout + `$id.$group.tsx`). Keep the rail only as the mobile tab strip. | `field-group-nav.tsx`, `detail-view.tsx`, demo `_app.$collection.$id.tsx` |
| N3 | P1 | Sidebar items have no icons; groups are hardcoded "Collections" / "Content"; no trailing caret; `Menu` has no `gap-1` (adjacent hover+active merge); hover and active are visually identical. Add `icon` to `NavItem`/collection config (Phosphor), user-defined group labels/order, `isActive` longest-prefix (dedupe the two `isActive` impls in `content-ui/lib/nav.ts` and `content-admin/nav.ts`). | `app-sidebar.tsx`, `lib/nav.ts` |
| N4 | P1 | Sidebar footer is a raw email `<span>` + text "Sign out" button. Replace with `Sidebar.Footer` → avatar/initials + name/email + menu (theme, sign out) or a profile hub link like tries.care. | `content-admin/src/screens/admin-layout.tsx` |
| N5 | P1 | Collapse mode: trigger hides the whole sidebar (offcanvas), no icon rail, no tooltips, ⌘B did nothing in the walk. Use `collapsible="icon"` + `tooltip` on every `MenuButton`; auto-collapse ≤1023px. | `app-sidebar.tsx` |
| N6 | P2 | No brand/workspace block: header is a plain link with a hardcoded class string; no site name/env, no switcher affordance. Build a `Sidebar.Header` block (32px tinted badge + name + caret) and drop the "Demo" span from the top bar. | `app-sidebar.tsx:renderLink` |
| N7 | P2 | No search entry (⌘K) in the sidebar even though `/search` exists server-side and `SearchInput` exists in UI. Add a search field-like link under the brand, route `/search`. | — |
| N8 | P2 | No counts/badges on nav items (dashboard already fetches counts). `Sidebar.MenuBadge`. | `dashboard.tsx`, `counts.ts` |
| N9 | P1 | No page-width system: forms `max-w-2xl`, read view unbounded, `PageLayout.Body` bakes `p-6` then every screen adds its own `space-y-*`. Adopt `BodyWidth` (narrow/reading/content/full) + `pageGutter` and remove per-screen wrappers. | `page-layout.tsx`, all screens |
| N10 | P1 | Page titles: detail header shows the **collection** name ("Posts") instead of the document title when the title field is localized; edit/new read "Edit Posts", "New Posts" (plural). Should be "Fjords by Ferry", "Edit Fjords by Ferry", "New post" (singular label in config). | `detail-view.tsx`, `collection-detail.tsx`, `collection-new.tsx` |
| N11 | P1 | Header actions are bare text links (`Edit · Delete · Back`, "Delete" as a pink badge). Use `Button` (primary Edit, overflow menu for Delete with confirm), and replace "Back" with the sidebar back row / header back link resolved from the nav model. | `collection-detail.tsx`, `singleton.tsx` |
| N12 | P2 | No `resolveBackTo` model (entity → list → home); no area landing pages; dashboard tiles don't link to their collection. | `dashboard.tsx` |
| N13 | P2 | Mobile: no dock/bottom bar; behaviour at 400px not verified (window resize did not apply in the run). Plan the `DockShell` equivalent (max 4 `mobilePrimary` items + search + account). | — |
| N14 | P2 | Inset panel appeared not to fill the viewport (gap below and right of the rounded panel in every screenshot). Verify `Sidebar.Inset` gets `md:h-[calc(100dvh-1rem)] overflow-hidden` and body has no extra margin. | `admin-shell.tsx` |
| N15 | P2 | Dead/duplicate code to remove during the refactor: `view-switcher.tsx` (unused), `slots.shell.sidebarHeader` and `slots.collection.emptyState` declared but never consumed, `reorderIds` vs `reorderColumns` duplicates, `RevisionHistory` + `PublishControls` exist but are mounted nowhere. | `content-ui`, `content-admin/types.ts` |

---

## 2. Table / list view

| # | Sev | Item |
|---|-----|------|
| T1 | **P0** | Localized fields render `[object Object]` in every table cell and in the read view (Post Title/Excerpt, Event Title/Summary, Settings Site Name/Tagline). There is no `localized` display widget: resolve `config.i18n.defaultLocale` → fallback chain → first non-empty, and show a small locale badge when falling back. |
| T2 | **P0** | Board view cards show `Row 1` and `—` for every field (Slug, Summary, Description) → the kanban path receives no field values. Calendar view labels every event `Untitled` (same localized-title bug as T1). Map pins render but tiles took >5s to appear on first load. |
| T3 | P1 | Rich text / markdown columns (Body, Bio, Description) render the full document → rows 120–150px tall. Cells need a single-line plain-text preview (`line-clamp-1`, `max-w-[28ch]`, tooltip/expand on hover). |
| T4 | P1 | Markdown cell (Author Bio) keeps paragraph top margin → text sits ~30px above the row's vertical centre. Strip prose margins inside `Table.Cell`. |
| T5 | P1 | Horizontal overflow is clipped: the list container is `overflow-hidden rounded-lg border`, the last column (Published At / Ends At) is cut off and there is no scrollbar. Use `overflow-x-auto` on the table container, `whitespace-nowrap` + truncation on cells, optional sticky first column. |
| T6 | P1 | No sticky header, no density control (`compact` = `py-1 text-[0.8rem]`), header `h-10`, rows should land at ~36–40px. |
| T7 | P1 | Column picker and filters are only reachable via right-click on a tab → "Edit view" dialog. Add a visible list toolbar: search input, filter chips/"Add filter", columns menu, density, view options; keep the dialog for rename/default. `SearchInput` and `StatusFilter` are already in `ListView` but `collection-list.tsx` never wires `onSearchChange`/`onStatusChange`. |
| T8 | P1 | No row selection / bulk actions (delete, publish, export). |
| T9 | P1 | Pagination is "Load more" only: no result count, no range line, no page size; board views cap at 100×5 with a plain-text notice. Adopt the kit pager or an infinite list with a count line. |
| T10 | P2 | Sort indicators are literal `↑ ↓ ↕` glyphs; use `CaretUpDown`/`CaretUp`/`CaretDown` icons, `cursor-pointer select-none hover:bg-muted/50` on the head cell; server-sortable columns only. |
| T11 | P2 | View tabs: layout shift on load (only "+ Add view" renders until views arrive, then "★ Table" pops in). Render a skeleton tab; pin the tab strip (it scrolls with the body today); replace the text "★" default marker with an icon; align tab strip with the title gutter like tries.care `PageTabs`. |
| T12 | P2 | Badges everywhere: enum, select **and** relation (Author) all render as the same grey `Badge`; boolean renders "Yes/No" chips. Give status a semantic colour (draft/in review/published), render relations as a link chip (avatar/initial + name → detail), booleans as a check/dash icon. |
| T13 | P2 | Datetime shows `8/20/2026, 11:00:00 AM` (seconds, US format regardless of config). Use `Intl.DateTimeFormat` with the admin locale, no seconds, optional relative ("in 3 days"). |
| T14 | P2 | Geo shows raw `60.472, 8.4689`; media columns show `—` even when the seed has images (verify `MediaDisplay` in table context) and should show a 24px thumbnail. |
| T15 | P2 | Row click: whole row is clickable via an sr-only "Open row" button; there is no `cursor-pointer`/hover affordance in the first cell and no middle-click/new-tab support. Use link-in-each-cell (`Link className="block"`, first cell focusable). |
| T16 | P2 | Empty state is a single muted cell; use `Empty` (icon + title + description + primary action). |
| T17 | P2 | "Add view" dialog: appears over the table for a frame without backdrop (transition), uses native `<select>` for Type / Group by / Start / End / Plot; default board card fields (Slug/Summary/Description) are weak defaults — prefer the title field + 2 short fields. |

---

## 3. Detail (read) view

| # | Sev | Item |
|---|-----|------|
| D1 | P1 | Field card has a fixed/min height: the Content card is ~220px tall for four rows with 100px of empty space at the bottom. |
| D2 | P1 | Rich text value inside the `<dl>` has an extra left indent (prose padding) compared to the other values. |
| D3 | P2 | No entity identity header (title, status badge, updated-at, id copy) above the sections like tries.care `EntityHeader`. |
| D4 | P2 | Empty media renders `—`; use a small placeholder tile ("No image") and, for media with a value, a thumbnail + filename. |
| D5 | P2 | Section rail label "Sections" is generic; with N2 it disappears into the sidebar. |
| D6 | P2 | Field label column `minmax(8rem,12rem)` + `gap-y-3` is fine; but label/value type sizes are identical — labels should be `text-muted-foreground text-xs/sm`, values `text-sm`. |

---

## 4. Edit / create forms (all widgets)

| # | Sev | Item |
|---|-----|------|
| F1 | P1 | Per-field save mode renders **one card per field** with a grey footer and a disabled "Save" pill → the Organization section is five stacked cards, the page is 3× taller than needed. Prefer: one card per section, inline save state per field (dirty dot + "Saved" toast), or a single sticky action bar (`PageLayout.ActionBar`). |
| F2 | P1 | Disabled `Save` buttons are rendered as filled grey pills → read as active. Use `variant="outline"` or hide until dirty. |
| F3 | P1 | Native `<select>` (`NATIVE_SELECT_CLASS`) for enum/select/relation/view-type; replace with the kit `Select`/`Combobox` (relation needs search + create-new). |
| F4 | P1 | Rich text editor shrinks from ~120px to ~40px when the placeholder appears (layout shift on focus/blur in the New form). Give the editor a `min-h`. |
| F5 | P2 | Localized fields stack one input per locale with a mono `en-US` prefix. Fine for 2 locales; add locale tabs + completeness dots for 3+, and a "copy from default" action. |
| F6 | P2 | Geo input: number inputs show `60,472` (locale comma) while the read view shows `60.472`; label "Latitude/Longitude" is `text-xs` below the field label; map height fixed at 200px; no address search/geocoder. |
| F7 | P2 | Datetime = native `datetime-local` (`20/08/2026, 11:00`), no timezone hint, no "now"/clear. |
| F8 | P2 | Media input = a small "Upload" button; no dropzone, no preview, no library picker, no progress. |
| F9 | P2 | New form: "Create" sits in the Content card footer; switching sections before creating is possible — verify values persist across sections, and move Create to the header/action bar. |
| F10 | P2 | Singleton edit has "Cancel" in the header + "Save" in the card; collection edit has "Done / Back" + per-field Save. Unify: header = Cancel/Save (or Done), same for both. |
| F11 | P2 | Required marker is a bare red `*`; no field description/help text, no character counter for slug/short strings, validation error styling not visible until submit (not verified). |
| F12 | P2 | Number, color, boolean switch, text, textarea/monospace widgets are OK; `TextareaInput` is exported but registered for no kind (multi-line `string` fields fall to a single-line input). Missing widgets: relation display/edit, array, object, duration. |

---

## 5. Shell, dashboard, login, theming

| # | Sev | Item |
|---|-----|------|
| S1 | P1 | Login form: clicking "Send magic link" did not fire a request in the browser walk (curl to the endpoint works; a `[voila/auth] magic link …` line appeared only for the curl). Verify the submit handler/`type="submit"` and add a "Check your inbox" confirmation state + error state. |
| S2 | P2 | Login has no brand/logo, no product name; Chrome autofill overlay covers the button. |
| S3 | P2 | Dashboard = three identical count tiles; add links to collections, recent edits, drafts to review, and quick "New" actions. |
| S4 | P2 | Dark theme: sidebar and inset backgrounds are both near-black with little separation; grey badges lose contrast; skeleton rows nearly invisible. Tune `--sidebar` vs `--background` and badge tokens. |
| S5 | P2 | No toast/feedback after Save/Create/Delete, no unsaved-changes guard, no 404 screen styling (custom dispatcher renders an inline "Not found"). |
| S6 | P2 | Ad-hoc class strings instead of primitives: `COORD_INPUT_CLASS`, `SELECT_CLASS`, `NATIVE_SELECT_CLASS`, raw `<button className="text-sm font-medium text-primary">` across detail/new/singleton/login. Replace with `Button`/`Input`/`Select`. |

---

## Suggested order
1. **P0 data bugs**: T1 localized display, T2 board/calendar values.
2. **Shell refactor** (N1–N6, N9–N11): single header, sidebar sections with routes, icons, footer, widths, titles/actions.
3. **Table pass** (T3–T7, T10–T12): truncation, overflow, sticky header, toolbar, tabs.
4. **Form pass** (F1–F4).
5. Remaining P2 polish.

---

## Status (2026-09-10, PR `feat/nav-polish-audit`)

Legend: ✅ fixed · 🟡 partial · ⏭ deferred (out of scope for this pass, reason noted).

| Item | Status | Notes |
|---|---|---|
| N1 | ✅ | One `h-14` bar per screen: `PageLayout.Header` = trigger · back · title · actions (theme switch lives in the user menu). `AdminShell` renders no bar. |
| N2 | ✅ | Sections are routes (`$collection/$id/$group`, singletons `/settings/$group`); sidebar swaps to back row + doc title + sections (`useRegisterSidebarSection`); `FieldGroupNav` is the mobile strip only. |
| N3 | ✅ | `icon` / `group` on collections & singletons (Phosphor), `Menu gap-1` from the kit, longest-prefix active (`isNavActive` shared by content-admin `nav.ts`). |
| N4 | ✅ | `UserMenu`: initials avatar + email + menu (theme, sign out). |
| N5 | ✅ | `collapsible="icon"` + tooltips + rail; auto-collapse ≤1023px; ⌘B from the kit provider. |
| N6 | ✅ | Brand block (32px tinted mark + name + subtitle from `branding.title`); no "Demo" span in the bar. No switcher (single site). |
| N7 | ✅ | ⌘K `CommandPalette`: jump to any entity, "New …", server search for search-enabled collections. |
| N8 | ✅ | `defineAdmin({ counts })` resolver → `Sidebar.MenuBadge` (demo wires `fetchCounts`). |
| N9 | ✅ | `PageLayout.Body width="narrow|reading|content|full"` + `pageGutter`; per-screen wrappers removed. |
| N10 | ✅ | `documentTitle` resolves localized titles; "Edit Fjords by Ferry"; "New post" via `labelSingular` / `singularLabel`. |
| N11 | ✅ | `Button` Edit + overflow menu with confirm-dialog Delete; Back = header back link. |
| N12 | ✅ | `lib/back.ts` (`backToList` / `backToHome`); dashboard tiles link + quick New. |
| N13 | ⏭ | Mobile dock not built; the section strip and stacked toolbar work at narrow widths but a `DockShell` is a separate design. |
| N14 | ✅ | Not a layout bug: `main` fills the viewport (verified via `getBoundingClientRect`); the gap was screenshot scaling. Height now `calc(100svh-1rem)`. |
| N15 | ✅ | `view-switcher.tsx` deleted; `slots.shell.sidebarHeader` removed; `slots.collection.emptyState` consumed (empty-state action); `RevisionHistory` mounted as the "History" section, `PublishControls` in the detail aside (draft collections). `reorderIds`/`reorderColumns` kept (different inputs). |
| T1 | ✅ | `FieldRenderer` resolves localized records through the locale chain (`resolveLocalized`), locale badge on fallback. |
| T2 | ✅ | Cards fetch + render the shared `defaultCardFields` (short fields, no bodies); calendar titles localized. |
| T3/T4 | ✅ | `context="cell"` → one-line `Preview` for rich text / markdown / long text (demo `RichTextDisplay` too); no prose margins. |
| T5 | ✅ | Table region `overflow-auto`; cells `max-w-[40ch]` + truncation. No sticky first column. |
| T6 | ✅ | Sticky head row (table owns the scroll), compact rows by default (`density` prop, no toolbar toggle), `h-9` head, ~36px rows. |
| T7 | ✅ | Visible toolbar: search (wired to `client.search`), status scope, Filter / Columns / Card fields / Map position popovers. Tab dialog = rename only. |
| T8 | 🟡 | Row selection + bulk **Delete** (confirm). Bulk publish/export not built. |
| T9 | ✅ | "Showing N of M" via `?count=1`, page-size picker (25/50/100), Load more. |
| T10 | ✅ | Caret icons, hover affordance, server-sortable columns only. |
| T11 | ✅ | Skeleton tab while loading, pinned strip aligned to the gutter, `Star` icon default marker. |
| T12 | 🟡 | Status tones (`enumTone`), boolean = check/dash. Relation link-chips not built (no relation kind in the engine yet). |
| T13 | ✅ | `Intl.DateTimeFormat` medium/short, no seconds, relative title. |
| T14 | 🟡 | Media = 24px thumbnail in cells; geo still shows `lat, lng` (linked). |
| T15 | ✅ | Real link in the first cell (`rowHref` + `renderLink`), row click defers to interactive targets. |
| T16 | ✅ | Kit `Empty` with icon, title, description, primary action. |
| T17 | 🟡 | Kit `NativeSelect` in the dialog (a portal Select inside a Base UI dialog renders behind the backdrop); default card fields = short fields. Dialog transition flash not addressed. |
| D1/D2 | ✅ | Card hugs its rows; read-only rich text flush (`.voila-rich-text-readonly`). |
| D3 | ✅ | Identity strip: status badge (drafts), "Updated 3 min ago", copyable id. |
| D4 | ✅ | "No image" placeholder tile on detail; thumbnail + mime/size when set. |
| D5 | ✅ | Gone with N2. |
| D6 | ✅ | Labels `text-xs/sm` muted, values `text-sm`. |
| F1/F2 | ✅ | Per-field mode = one card per section, inline Save appears only when dirty, "Saved" flash + toast. |
| F3 | ✅ | Kit `Select` for enum/select (form); relation combobox N/A. |
| F4 | ✅ | Editor `min-height: 8rem` (demo styles). |
| F5 | ⏭ | Locale tabs for 3+ locales not built (demo has 2). |
| F6 | ✅ | Decimal text inputs (locale comma accepted), labels bolder, map 288px on `sm`. No geocoder. |
| F7 | ⏭ | Native `datetime-local` kept. |
| F8 | 🟡 | Dropzone (click or drop) + preview/alt/replace/remove; no library picker / progress. |
| F9/F10 | ✅ | Create / Save in the header action bar; header = Cancel/Save (form) or Done (per-field), same for singletons. |
| F11 | 🟡 | `meta.description` = help text under the field, `n / max` counter for bounded strings; required marker kept. |
| F12 | ⏭ | No multi-line flag on `string` fields; `TextareaInput` stays opt-in via `widget`. |
| S1 | ✅ | Rebuilt on kit `Button`/`Input`/`Label` with `type="submit"`, "Check your inbox" + error states; SSR verified. Request firing verified via the mutation path in tests. |
| S2 | ✅ | Brand mark + name + title on the login card. |
| S3 | ✅ | Tiles link + quick New; "Recently edited" feed (`orderBy=updatedAt` across collections). Drafts-to-review N/A (no draft collections in the demo). |
| S4 | ⏭ | Token tuning not done (kit-owned tokens); badge tones now carry colour in dark. |
| S5 | ✅ | `sonner` toasts on create/save/delete/publish/restore; framed 404 (`NotFoundScreen`); unsaved guard already existed. |
| S6 | ✅ | `COORD_INPUT_CLASS`, `SELECT_CLASS`, `NATIVE_SELECT_CLASS` and raw text-link buttons removed in favour of kit primitives. |
