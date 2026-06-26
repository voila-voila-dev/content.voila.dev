// FieldCard — the polished card a grouped detail/edit page wraps each section in:
// a padded body over a distinct footer bar (where a group's Save lives in the
// edit form). Compound API mirroring the guide-scpi admin's `FormCard`, retoned
// to `@voila/ui` tokens (it has no `card-footer` token, so the footer uses a
// muted tint). Purely presentational — the body/footer content is the caller's.

import { Button } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import type { ComponentProps } from "react";

function Root({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("text-card-foreground", className)} {...props} />;
}

// A fully-closed, self-contained card (all four borders + corners). The read
// view uses this — there's no Save footer to close the card off, so a bare
// `Body` (which is open-bottomed, expecting a `Footer`) would look unfinished.
function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card p-6", className)} {...props} />;
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-t-lg border-x border-t bg-card p-6", className)} {...props} />;
}

function Title({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-semibold text-xl", className)} {...props} />;
}

function Description({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("my-3 text-muted-foreground text-xs", className)} {...props} />;
}

function Footer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-b-lg border bg-muted/40 px-6 py-3",
        className,
      )}
      {...props}
    />
  );
}

function FooterDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-xs", className)} {...props} />;
}

function FieldCardButton(props: ComponentProps<typeof Button>) {
  return <Button size="sm" {...props} />;
}

/** Compound card for a field group's section. `FieldCard.Root` wraps a
 *  `FieldCard.Body` (fields) and an optional `FieldCard.Footer` (Save). */
export const FieldCard = {
  Root,
  Card,
  Body,
  Title,
  Description,
  Footer,
  FooterDescription,
  Button: FieldCardButton,
};
