# 07 — Theming & Admin UI

The admin is built to look like a serious product, not a CMS. Visually modeled on the admins of **[1year.com.tw](https://1year.com.tw)** and **[guide-scpi.fr](https://guide-scpi.fr)**: dense but quiet, monochrome with a single accent, generous spacing inside cards, hairline borders, no gradients.

## You own the admin code

The admin UI is **vended into your repo** by the registry CLI — you do not import a black-box admin package at runtime. `voila add admin-shell` (and friends) copies real source files into your project. You own them, restyle them directly, and evolve them at your own pace.

`@voila/ui` is the **source-of-truth** for all registry UI items: shadcn-on-Base-UI primitives, Tailwind v4 token layer, Phosphor icons. The registry reads from `@voila/ui` and copies the result. Theming means editing your vended files and token CSS — not toggling a config knob in `defineContent`.

## Design language

| Aspect       | Choice                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Primitives   | [Base UI](https://base-ui.com) (unstyled, accessible, headless)         |
| Patterns     | shadcn/ui compositions on top of Base UI                                |
| CSS          | Tailwind v4 + native CSS variables — use `(--var)` syntax, not `[--var]` |
| Icons        | [Phosphor](https://phosphoricons.com) — outline weight as default       |
| Typography   | `Inter` for UI, `JetBrains Mono` for code/IDs                           |
| Radii        | 6px default, 4px for dense controls                                     |
| Borders      | 1px, `--voila-border` (≈ 6% contrast on background)                     |
| Shadows      | One elevation only: `--voila-shadow` (soft, 0/2/8 rgba)                 |
| Motion       | 120ms ease-out for everything; no spring                                |

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────────────┐  ┌──────────────────────────────────────────────┐    │
│  │  ▣  Acme CMS   │  │  Posts                            [+ Create] │    │
│  │                │  ├──────────────────────────────────────────────┤    │
│  │  Dashboard     │  │  Search…    Filters ▾    Sort: Published ▾  │    │
│  │                │  ├──────────────────────────────────────────────┤    │
│  │  ▾ Content     │  │  Title           Published      Tags         │    │
│  │     Posts      │  │  ─────────────────────────────────────────── │    │
│  │     Authors    │  │  Hello world     Mar 2 2026     • news       │    │
│  │  ▾ Marketing   │  │  Why TanStack    Feb 28 2026    • dev • opin │    │
│  │     Settings   │  │  …                                            │    │
│  │     SEO        │  │                                               │    │
│  │  Media         │  │                                               │    │
│  │                │  │                                               │    │
│  │  ────────────  │  │                                               │    │
│  │  ◐  Dark       │  │                                               │    │
│  │  👤 you@acme   │  │                                               │    │
│  └────────────────┘  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Sidebar**: 240px, collapsible to 56px, sticky.
- **Topbar**: page title + primary action only.
- **Content**: max-width 1280px; list views are full-bleed.
- **Detail pages**: two-column on ≥ lg: form on the left (max-w-3xl), sidebar (status, meta, activity) on the right.

## Tokens

All visual decisions go through CSS variables. The vended `app/styles/globals.css` is yours to edit:

```css
/* app/styles/globals.css — VENDED, you own this */
@import "@voila/ui/tokens.css";

:root {
  /* Brand */
  --voila-color-accent:        oklch(0.62 0.22 27);   /* warm orange */
  --voila-color-accent-fg:     white;

  /* Neutrals (light) */
  --voila-color-bg:            oklch(1 0 0);
  --voila-color-bg-muted:      oklch(0.985 0 0);
  --voila-color-fg:            oklch(0.18 0 0);
  --voila-color-fg-muted:      oklch(0.45 0 0);
  --voila-border:              oklch(0.92 0 0);

  /* Sizing */
  --voila-radius:              6px;
  --voila-radius-sm:           4px;
  --voila-sidebar-width:       240px;

  /* Motion */
  --voila-motion-fast:         120ms;
  --voila-motion-ease:         cubic-bezier(.2,.6,.2,1);
}

:root[data-theme="dark"] {
  --voila-color-bg:            oklch(0.16 0 0);
  --voila-color-bg-muted:      oklch(0.20 0 0);
  --voila-color-fg:            oklch(0.96 0 0);
  --voila-color-fg-muted:      oklch(0.70 0 0);
  --voila-border:              oklch(0.30 0 0);
}
```

Every Tailwind utility in the vended components references these variables via Tailwind v4's `(--var)` CSS-variable syntax. Changing `--voila-color-accent` cascades to buttons, links, focus rings, active sidebar items, primary badges, etc.

## Tailwind setup

The vended admin components use a scoped Tailwind layer sourced from `@voila/ui`:

```css
@layer voila;     /* admin styles */
@layer base, components, utilities;   /* your app */
```

This means the admin's Tailwind cannot pollute your public site, and vice versa, even when both are mounted on the same Vite project.

If you don't use Tailwind in your public app, that's fine. The admin doesn't need you to.

## Components

`@voila/ui` is the source package; the registry vends the components you actually need into your repo. The catalog includes:

```
button, badge, card, table, dropdown, dialog, drawer, popover,
combobox, select, datepicker, calendar, tabs, accordion, toast,
tooltip, command palette, kbd, breadcrumb, pagination, empty state
```

Each vended component is:

- a thin wrapper around Base UI primitives,
- styled with token variables,
- accessible by default,
- exported as both a composed component and its primitive parts.

```tsx
// after voila add button popover — these are your files
import { Button } from "~/components/voila/ui/button"
import * as Popover from "~/components/voila/ui/popover"  // primitive parts

<Button variant="primary" icon="Plus">Create</Button>

<Popover.Root>
  <Popover.Trigger>…</Popover.Trigger>
  <Popover.Content>…</Popover.Content>
</Popover.Root>
```

## Icons

Phosphor only, single source. Use the helper to keep tree-shaking honest:

```tsx
import { Icon } from "~/components/voila/ui/icon"
<Icon name="NewspaperClipping" weight="duotone" size={16} />
```

Field/collection `icon` strings are typed against the Phosphor name union.

## Updating vended code

Because you own the files, `npm update` does not push admin UI changes into your project. Use:

```
voila diff          # show drift between your vended copy and upstream
voila add <item>    # re-vend (merge, don't overwrite) a registry item
voila list          # browse what's available
```

You control when to take upstream changes. Breaking engine↔vended contracts are flagged by TypeScript at upgrade time — the typed client shape and widget props are the stable public API.

## Customizing the head

The vended admin shell file exposes a `<head>` slot. Edit it directly:

```tsx
// app/routes/admin/_shell.tsx — VENDED, you own this
<head>
  <link rel="preconnect" href="https://media.acme.com" />
  {/* add anything here */}
</head>
```

## Admin UI is translatable

The admin is fully translated via its own Paraglide/Inlang project, compiled into the vended files at registry build time. A locale picker lives above the user menu in the sidebar footer; selection persists as a cookie. To override or extend strings, edit the vended message catalog directly — no forking needed. The admin's locale is independent of the site's locale — see [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md).

## Replacing a component

For deep customization, edit the vended file directly — it's yours. If you want a completely different component (e.g. your own command palette), replace the import in the file that uses it:

```tsx
// app/components/voila/command-palette.tsx — VENDED, yours to edit
import { MyCommandPalette } from "~/components/command-palette"
export { MyCommandPalette as CommandPalette }
```

No `ui.overrides` config key needed — the file is the override.

---

Continue → [08 — Extensions](./08-extensions.md)
