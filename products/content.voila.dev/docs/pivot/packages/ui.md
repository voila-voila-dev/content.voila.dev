# @voila/ui

> shadcn-on-Base-UI primitives, Tailwind v4 token layer, and Phosphor icons —
> the source-of-truth for every UI primitive used in registry items. **World:**
> Head / cross-product. **Status:** current; feeds registry items in pivot.

## Responsibility

Owns all shared React primitives (buttons, inputs, tables, dialogs, sidebars…),
the Tailwind v4 CSS-variable token layer, and the Phosphor icon re-export. This
package is the **upstream source** that `@voila/content-registry` items import during
authoring; it also ships as a normal npm dependency for consumers who want to
use the primitives directly in their own components.

Does **not** own CMS-specific logic, routing, data fetching, or any Effect code.
Does not own field widgets (those are registry items in `@voila/content-registry`).

## Public API / Registry Items

### npm exports

```ts
// @voila/ui — all primitives
import { Button, Input, Table, Sidebar, Dialog, Badge, ... } from "@voila/ui"
import { cn } from "@voila/ui"          // clsx + tailwind-merge util
import { useIsMobile } from "@voila/ui" // responsive hook

// Icons (Phosphor, thin wrapper)
import { icons } from "@voila/ui/icons"
```

### CSS / token layer

```css
/* app/styles/voila.css — vended by the "theme" registry item */
@import "@voila/ui/styles.css"; /* Tailwind v4 @theme layer + base resets */
```

Tailwind v4 CSS-variable tokens use the **`(--var)` syntax**, not bare `[--var]`
(the bracket form is broken in v4). All components in this package follow that
convention; custom overrides in vended files must do the same.

### Registry item role

`@voila/content-registry` lists individual `@voila/ui` components as registry items when
a consumer wants a standalone primitive (`voila add data-table`). Those items
point back to the source in `@voila/ui` — no copy is made; the component ships
as a normal npm import in the consumer's vended route files.

For the **theme** registry item specifically, `voila add theme` copies
`app/styles/voila.css` (the token layer) into the consumer's repo so they can
extend or override tokens freely.

## How it feeds the registry

Registry item source files (authored in `@voila/content-registry`) `import` from
`@voila/ui` at dev time. When `voila add` copies a vended file into the
consumer app, those imports remain as `@voila/ui` npm imports — the consumer
installs `@voila/ui` as a dependency. The token CSS file is the one thing
physically copied (it's meant to be edited by the user).

## Dependencies

- `@base-ui-components/react` — unstyled primitives (replaces Radix UI)
- `tailwindcss` v4 — CSS-variable token layer; no JS config file
- `phosphor-react` — icon set (re-exported via `@voila/ui/icons`)
- `clsx`, `tailwind-merge` — `cn()` util

## Usage

```tsx
// In a vended table route (owned by the consumer after `voila add posts-table`)
import { Button, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@voila/ui"

function PostsTable({ posts }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.title}</TableCell>
            <TableCell><Badge>{p.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```css
/* Override a token in the vended voila.css */
@import "@voila/ui/styles.css";

@layer theme {
  :root {
    --color-primary: oklch(55% 0.2 260); /* brand blue */
  }
}
```

## Replaces

- The existing `packages/ui/` (at repo root) is **this package** — no rename
  needed, only the pivot's registry wiring changes how it is consumed. The
  Radix UI primitives are progressively replaced by Base UI equivalents.
- The component imports inside `packages/content/src/admin/` (the retired React
  admin) — those components move to `@voila/content-registry` items and continue to
  import from `@voila/ui`.

## Testing

- Vitest + happy-dom: render each component, assert class names and ARIA
  attributes. Current `button.test.tsx` style is preserved.
- Visual: Storybook (one story per primitive) served as a static site; snapshots
  gated in CI.
- Token layer: a Tailwind v4 build smoke-test asserts that `(--color-primary)`
  resolves without error and the bare `[--var]` form is absent from output.
