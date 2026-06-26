// PageLayout — the per-screen frame the list/detail/edit views render inside.
// The page itself never scrolls: a fixed `Header` (and, for grouped screens, a
// fixed full-height sub-nav) sits above a single scrolling `Body`. Modeled on
// the guide-scpi admin's `PageLayout`, retoned to `@voila/ui` tokens. Purely
// presentational and composable — `Root` caps the height and clips, `Header`
// carries the page `<h1>` + actions over a dashed separator, `NavigationLayout`
// lays a sub-nav beside the `Body`, and `Body` is the lone overflow-y region.

import { cn } from "@voila/ui/cn";
import type { ComponentProps } from "react";

// Fills its parent (the shell's body slot) and clips, so the page is a fixed
// frame and only `Body` scrolls. `min-h-0` lets it shrink inside the shell's
// flex column instead of growing the page.
function Root({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)} {...props} />
  );
}

// The pinned page header: title (+ description) on the left, actions on the
// right, over a dashed bottom separator. `shrink-0` keeps it out of the scroll.
function Header({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex shrink-0 flex-col items-start justify-between gap-4 border-b border-dashed border-border px-6 py-4 md:flex-row md:items-center",
        className,
      )}
      {...props}
    />
  );
}

function Title({ className, ...props }: ComponentProps<"h1">) {
  // `tabIndex={-1}` so a host can move focus here on a route change (SPA focus
  // management) without it landing in the tab order.
  return (
    <h1
      tabIndex={-1}
      className={cn("font-bold text-2xl focus:outline-none", className)}
      {...props}
    />
  );
}

function Description({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

// The row holding a (full-height) sub-nav beside the `Body`. On mobile the nav
// stacks above the body; on `lg` they sit side by side and the nav's right
// border runs the full height (the body, not this row, is what scrolls).
function NavigationLayout({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 flex-1 flex-col lg:flex-row", className)} {...props} />;
}

// The lone scroll region. An inner padded wrapper holds the content so the
// scrollbar tracks the padded edge.
function Body({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cn("p-6", className)} {...props} />
    </div>
  );
}

function Footer({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-t border-dashed border-border px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** Composable per-screen frame: `Root > Header + (NavigationLayout > nav +)
 *  Body`. The page is fixed; only `Body` scrolls. */
export const PageLayout = {
  Root,
  Header,
  Title,
  Description,
  NavigationLayout,
  Body,
  Footer,
};
