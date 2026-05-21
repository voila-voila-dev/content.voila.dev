# @voila/ui

Cross-product design system for Voila — design tokens, a Tailwind v4 preset,
Phosphor icon re-exports, and shadcn-derived React primitives.

Lives at the repo root (`packages/ui`) so any product under `products/*` can
depend on it without coupling to a product-specific package.

## Subpaths

| Subpath              | What it ships                                            |
| -------------------- | -------------------------------------------------------- |
| `@voila/ui`          | React primitives (Button, Card, Input, Label, Separator) and the `cn` helper |
| `@voila/ui/styles.css` | Raw CSS design tokens (colors, spacing, radii, typography) |
| `@voila/ui/tailwind` | Tailwind v4 preset — imports `tailwindcss` + tokens + `@theme` mapping |
| `@voila/ui/icons`    | Re-export of `@phosphor-icons/react`                     |

## Usage

```css
/* app entry stylesheet — one import gives you Tailwind + tokens */
@import "@voila/ui/tailwind";
```

```tsx
import { Button, Card, CardContent } from "@voila/ui";
import { ArrowRight } from "@voila/ui/icons";

export function Example() {
  return (
    <Card>
      <CardContent>
        <Button>
          Continue <ArrowRight />
        </Button>
      </CardContent>
    </Card>
  );
}
```

Override any token by re-declaring the CSS variable on `:root` (or a scoped
element) in your app — no preset extension API needed.

## Primitives

M0 ships a starter set: `Button`, `Input`, `Label`, `Card` (+ subparts), and
`Separator`. The remaining shadcn primitives land alongside the admin surfaces
that need them — tracked in
[docs/requirements/12-roadmap.md](../../products/content.voila.dev/docs/requirements/12-roadmap.md).
