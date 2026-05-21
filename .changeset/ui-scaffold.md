---
"@voila/ui": minor
---

Scaffold `@voila/ui` at the repo root (`packages/ui`) as the cross-product
design system.

Ships four subpath exports:

- `@voila/ui` — React primitives derived from shadcn (Button, Card, Input,
  Label, Separator) plus the `cn` utility
- `@voila/ui/styles.css` — raw CSS design tokens (colors, spacing, radii,
  typography) with light/dark variants
- `@voila/ui/tailwind` — Tailwind v4 CSS-first preset that imports tokens and
  maps them into `@theme`
- `@voila/ui/icons` — re-export of `@phosphor-icons/react`

The remaining shadcn primitives land alongside the admin surfaces that need
them — tracked in `docs/requirements/12-roadmap.md`.
