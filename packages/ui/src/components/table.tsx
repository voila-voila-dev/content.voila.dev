import type * as React from "react";
import { cn } from "#lib/cn";

function Root({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function Header({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function Body({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function Footer({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function Row({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function Head({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function Cell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  );
}

function Caption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}

export const Table = { Root, Header, Body, Footer, Row, Head, Cell, Caption };
