import type * as React from "react";
import { cn } from "#lib/cn";

function Root({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

function Header({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

function HeaderTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

function HeaderDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function Content({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function Footer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export const Card = {
  Root,
  Header: {
    Root: Header,
    Title: HeaderTitle,
    Description: HeaderDescription,
  },
  Content,
  Footer,
};
