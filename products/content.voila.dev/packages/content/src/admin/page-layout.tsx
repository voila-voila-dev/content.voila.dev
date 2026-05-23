import { Link, useLocation } from "@tanstack/react-router";
import { cn, ScrollArea } from "@voila/ui";
import type { ComponentProps, ComponentType } from "react";

/**
 * PageLayout - composable layout for admin pages.
 *
 * The page never scrolls — only the Body content area is scrollable. Works
 * with or without a Navigation sidebar, and with or without a Footer.
 */

function Root({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-1 flex-col overflow-hidden", className)} {...props} />;
}

function Header({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex shrink-0 flex-col items-start justify-between gap-4 border-border border-b border-dashed px-6 py-4 md:flex-row md:items-center",
        className,
      )}
      {...props}
    />
  );
}

function Title({ className, ...props }: ComponentProps<"h1">) {
  return <h1 className={cn("font-bold text-2xl", className)} {...props} />;
}

function NavigationLayout({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 flex-1 flex-col lg:flex-row", className)} {...props} />;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
}

interface NavigationProps extends Omit<ComponentProps<"nav">, "children"> {
  title: string;
  items: NavigationItem[];
}

function Navigation({ title, items, className, ...props }: NavigationProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav
      className={cn(
        "flex shrink-0 border-border",
        "flex-row gap-1 overflow-x-auto overflow-y-hidden border-b p-2",
        "lg:w-[200px] lg:flex-col lg:gap-2 lg:overflow-x-visible lg:border-r lg:border-b-0 lg:p-4",
        className,
      )}
      {...props}
    >
      <h3 className="mb-2 hidden font-medium text-muted-foreground text-sm lg:block">{title}</h3>
      <div className="flex flex-row gap-1 lg:flex-col">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "transition-colors",
                isActive && "bg-accent font-medium text-accent-foreground",
              )}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return (
    <ScrollArea.Root className="min-h-0 flex-1">
      <div className={cn("p-6", className)} {...props} />
    </ScrollArea.Root>
  );
}

function Footer({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 px-6 py-4",
        "border-border border-t border-dashed",
        className,
      )}
      {...props}
    />
  );
}

export const PageLayout = {
  Root,
  Header,
  Title,
  NavigationLayout,
  Navigation,
  Body,
  Footer,
};
