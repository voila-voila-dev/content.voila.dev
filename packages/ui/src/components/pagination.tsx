import { CaretLeftIcon, CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { type ButtonProps, buttonVariants } from "#components/button";
import { cn } from "#lib/cn";

function Root({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function Content({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />;
}

function Item({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">;

function Link({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  );
}

function Previous({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 pl-2.5", className)}
      {...props}
    >
      <CaretLeftIcon className="h-4 w-4" />
      <span>Previous</span>
    </Link>
  );
}

function Next({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 pr-2.5", className)}
      {...props}
    >
      <span>Next</span>
      <CaretRightIcon className="h-4 w-4" />
    </Link>
  );
}

function Ellipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <DotsThreeIcon className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export const Pagination = { Root, Content, Item, Link, Previous, Next, Ellipsis };
