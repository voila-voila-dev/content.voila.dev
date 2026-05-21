# 07 — Theming & Admin UI

The admin is built to look like a serious product, not a CMS. Visually modeled on the admins of **[1year.com.tw](https://1year.com.tw)** and **[guide-scpi.fr](https://guide-scpi.fr)**: dense but quiet, monochrome with a single accent, generous spacing inside cards, hairline borders, no gradients.

## Design language

| Aspect       | Choice                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Primitives   | [Base UI](https://base-ui.com) (unstyled, accessible, headless)         |
| Patterns     | shadcn/ui compositions on top of Base UI                                |
| CSS          | Tailwind v4 + native CSS variables (no `theme()` indirection)           |
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

All visual decisions go through CSS variables. Override them in your app's `globals.css`:

```css
/* app/styles/globals.css */
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

Every Tailwind utility used by `@voila/ui` references these variables. Changing `--voila-color-accent` cascades to buttons, links, focus rings, active sidebar items, primary badges, etc.

## Tailwind setup

The admin owns its own Tailwind config (`@voila/ui/tailwind.config.ts`). It compiles to a scoped layer:

```css
@layer voila;     /* admin styles */
@layer base, components, utilities;   /* your app */
```

This means the admin's Tailwind cannot pollute your public site, and vice versa, even when both are mounted on the same Vite project.

If you don't use Tailwind in your public app, that's fine. The admin doesn't need you to.

## Components

`packages/ui` ships a small library of opinionated components:

```
button, badge, card, table, dropdown, dialog, drawer, popover,
combobox, select, datepicker, calendar, tabs, accordion, toast,
tooltip, command palette, kbd, breadcrumb, pagination, empty state
```

Each is:

- a thin wrapper around Base UI primitives,
- styled with token variables,
- accessible by default,
- exported as both a composed component and its primitive parts.

```tsx
import { Button } from '@voila/ui/button'
import * as Popover from '@voila/ui/popover'  // primitive parts

<Button variant="primary" icon="Plus">Create</Button>

<Popover.Root>
  <Popover.Trigger>…</Popover.Trigger>
  <Popover.Content>…</Popover.Content>
</Popover.Root>
```

## Icons

Phosphor only, single source. Use the helper to keep tree-shaking honest:

```tsx
import { Icon } from '@voila/ui/icon'
<Icon name="NewspaperClipping" weight="duotone" size={16} />
```

Field/collection `icon` strings are typed against the Phosphor name union.

## Customizing the head

The admin's `<head>` is templated. You can inject extras via `branding.head`:

```ts
branding: {
  head: ({ html }) => html`
    <link rel="preconnect" href="https://media.acme.com" />
  `,
}
```

## Admin UI is translatable

The admin SPA is itself fully translated via its own Paraglide/Inlang project, bundled at package build time. A locale picker lives above the user menu in the sidebar footer; selection persists as a cookie. Consumers can override or extend strings via `ui.messages` without forking. The admin's locale is independent of the site's locale — see [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md).

## Replacing a component (escape hatch)

For deep customization, swap any built-in component via `ui.overrides`:

```ts
import { MyCommandPalette } from './components/command-palette'

defineContent({
  ui: {
    overrides: {
      CommandPalette: MyCommandPalette,
    },
  },
})
```

The list of overridable components is documented in `@voila/ui/overrides`. Each receives a typed `props` interface so swaps are type-checked.

---

Continue → [08 — Extensions](./08-extensions.md)
