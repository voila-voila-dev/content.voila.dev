import { useRender } from "@base-ui-components/react/use-render";
import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

function Root(props: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" {...props} />;
}

function List({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 wrap-break-word text-sm text-muted-foreground sm:gap-2.5",
        className,
      )}
      {...props}
    />
  );
}

function Item({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

export interface BreadcrumbLinkProps extends React.ComponentProps<"a"> {
  ref?: React.Ref<HTMLAnchorElement>;
  render?: useRender.RenderProp<Record<string, unknown>>;
}

function Link({ ref, render, className, ...props }: BreadcrumbLinkProps) {
  return useRender({
    ref,
    // biome-ignore lint/a11y/useAnchorContent: consumer supplies the href + children
    // biome-ignore lint/a11y/useValidAnchor: consumer supplies the href
    render: render ?? <a />,
    props: {
      className: cn("transition-colors hover:text-foreground", className),
      ...props,
    },
  });
}

function Page({ className, ...props }: React.ComponentProps<"span">) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: aria-current marks current page, non-focusable by design
    // biome-ignore lint/a11y/useSemanticElements: shadcn convention exposes current-page as an aria-link span
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  );
}

function Separator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>
      {children ?? <CaretRightIcon />}
    </li>
  );
}

function Ellipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <DotsThreeIcon className="h-4 w-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export const Breadcrumb = { Root, List, Item, Link, Page, Separator, Ellipsis };
