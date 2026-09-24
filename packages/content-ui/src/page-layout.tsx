// PageLayout — the per-screen frame the list/detail/edit views render inside.
// The page itself never scrolls: ONE pinned `h-14` header bar (sidebar trigger ·
// back link · title · actions · theme toggle — the shell renders no bar of its
// own) sits above a single scrolling `Body`. Modeled on the tries.care admin's
// `page-layout.tsx`, retoned to `@voila.dev/ui` tokens. Purely presentational
// and composable — `Root` caps the height and clips, `Header` is the bar,
// `Toolbar` an optional second pinned strip (view tabs, filters), `Body` the
// lone overflow-y region with a `width` token so every screen shares the same
// content measures instead of hand-rolled `max-w-*` wrappers.

import { CaretLeftIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import { Sidebar } from "@voila.dev/ui/sidebar";
import { cn } from "@voila.dev/ui/utils";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cloneElement } from "react";
import { useMessages } from "./lib/messages";
import { useShell } from "./lib/shell-context";

// Fills its parent (the shell's body slot) and clips, so the page is a fixed
// frame and only `Body` scrolls. `min-h-0` lets it shrink inside the shell's
// flex column instead of growing the page.
function Root({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-layout"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

export interface HeaderProps extends Omit<ComponentProps<"header">, "title"> {
  /** A back link (see `PageLayout.Back`), rendered between the trigger and the title. */
  readonly back?: ReactNode;
  /** Actions on the right (buttons, an overflow menu). */
  readonly actions?: ReactNode;
  /**
   * Kept for source compatibility; the header no longer renders a theme toggle.
   * Appearance moved into the user menu, where it sits with the other
   * per-person preferences instead of occupying a slot on every page.
   */
  readonly hideThemeToggle?: boolean;
}

// The single pinned header bar. The sidebar trigger only renders inside the
// shell (it needs the kit's `Sidebar.Provider`), so the same page renders
// cleanly embedded or under test.
function Header({ className, back, actions, children, ...props }: HeaderProps) {
  const { inShell } = useShell();
  const m = useMessages();
  return (
    <header
      data-slot="page-layout-header"
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4",
        className,
      )}
      {...props}
    >
      {inShell ? (
        <Sidebar.Trigger className="-ml-1 shrink-0">
          <SidebarSimpleIcon />
          <span className="sr-only">{m.shell.toggleSidebar}</span>
        </Sidebar.Trigger>
      ) : null}
      {back}
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function Title({ className, ...props }: ComponentProps<"h1">) {
  // `tabIndex={-1}` so a host can move focus here on a route change (SPA focus
  // management) without it landing in the tab order.
  return (
    <h1
      data-slot="page-layout-title"
      tabIndex={-1}
      className={cn("truncate font-semibold text-base focus:outline-none", className)}
      {...props}
    />
  );
}

function Description({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="page-layout-description"
      className={cn("hidden truncate text-muted-foreground text-sm sm:block", className)}
      {...props}
    />
  );
}

export interface BackProps {
  readonly href: string;
  /** Accessible label + tooltip, e.g. "Back to Posts". */
  readonly label: string;
  /** Render the anchor (a framework `Link`); defaults to a plain `<a>`. */
  readonly renderLink?: (href: string) => ReactElement;
}

// The header's back link — an icon-only ghost button resolved from the nav
// model (entity → list → home), replacing breadcrumbs.
function Back({ href, label, renderLink }: BackProps) {
  // biome-ignore lint/a11y/useAnchorContent: children are injected below
  const anchor = renderLink ? renderLink(href) : <a href={href} />;
  return cloneElement(
    anchor as ReactElement<Record<string, unknown>>,
    {
      "data-slot": "page-layout-back",
      "aria-label": label,
      title: label,
      className:
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
    },
    <CaretLeftIcon className="size-4" aria-hidden />,
  );
}

// An optional second pinned strip under the header (view tabs, a filter bar).
function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-layout-toolbar"
      className={cn("flex shrink-0 flex-col border-b border-border bg-background", className)}
      {...props}
    />
  );
}

// The row holding a (full-height) sub-nav beside the `Body`. Kept for hosts that
// still want an inner rail; the shell's own pages put sections in the sidebar.
function NavigationLayout({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-layout-navigation"
      className={cn("flex min-h-0 flex-1 flex-col lg:flex-row", className)}
      {...props}
    />
  );
}

/** Content measure tokens: `narrow` (forms with short fields), `reading`
 *  (edit forms), `content` (read views), `full` (tables, boards). */
export type BodyWidth = "narrow" | "reading" | "content" | "full";

const BODY_WIDTH: Record<BodyWidth, string> = {
  narrow: "max-w-2xl",
  reading: "max-w-3xl",
  content: "max-w-4xl",
  full: "max-w-none",
};

/** The page gutter every body shares (also used by pinned toolbars). */
export const pageGutter = "px-4 sm:px-6";

export interface BodyProps extends ComponentProps<"div"> {
  readonly width?: BodyWidth;
  /** Drop the padding + measure (a full-bleed region that manages its own). */
  readonly bare?: boolean;
}

// The lone scroll region. An inner measured wrapper holds the content so the
// scrollbar tracks the viewport edge, not the content.
function Body({ className, width = "full", bare = false, ...props }: BodyProps) {
  return (
    <div data-slot="page-layout-body" className="min-h-0 flex-1 overflow-y-auto">
      <div
        data-width={width}
        className={cn(!bare && cn("mx-auto w-full py-6", pageGutter, BODY_WIDTH[width]), className)}
        {...props}
      />
    </div>
  );
}

function Footer({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      data-slot="page-layout-footer"
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** Composable per-screen frame: `Root > Header + Toolbar? + Body`. The page is
 *  fixed; only `Body` scrolls. */
export const PageLayout = {
  Root,
  Header,
  Back,
  Title,
  Description,
  Toolbar,
  NavigationLayout,
  Body,
  Footer,
};
