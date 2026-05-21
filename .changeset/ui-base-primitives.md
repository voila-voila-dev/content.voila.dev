---
"@voila/ui": minor
---

Add the full shadcn/ui primitive set to `@voila/ui`, built on **Base UI**
(`@base-ui-components/react`) and **React 19**.

In addition to the M0 starter (Button, Card, Input, Label, Separator), the
package now ships every primitive from shadcn/ui's registry, ported to Base
UI parts:

- Layout & overlays: Accordion, AlertDialog, AspectRatio, Collapsible,
  ContextMenu, Dialog, Drawer, DropdownMenu (Base UI's `Menu`), HoverCard
  (Base UI's `PreviewCard`), Menubar, NavigationMenu, Popover, Resizable,
  ScrollArea, Sheet, Sidebar, Tooltip
- Inputs & forms: Calendar, Checkbox, Form (Base UI `Field` +
  react-hook-form), InputOTP, RadioGroup, Select, Slider, Switch, Textarea,
  Toggle, ToggleGroup
- Data & feedback: Alert, Avatar, Badge, Breadcrumb, Carousel, Chart,
  Command, Pagination, Progress, Skeleton, Sonner (toast), Table, Tabs

Additions:

- `useIsMobile` hook (`@voila/ui` root) — used internally by Sidebar; safe
  to consume directly
- `--sidebar-*` design tokens in `styles.css` and the matching `@theme`
  mapping in `tailwind.css`

**React 19 only.** Every primitive is a plain function component using
React 19's ref-as-prop pattern — no `React.forwardRef`. `react` and
`react-dom` are referenced via the root workspace catalog (`catalog:`) and
pinned to `19.0.0`. shadcn's `asChild` prop is replaced by Base UI's
`render` prop. See `packages/ui/MIGRATION.md` for details.

Peer/optional deps: `recharts` (Chart) and `react-hook-form` (Form) ship as
optional peers — install them only in apps that use those primitives.
