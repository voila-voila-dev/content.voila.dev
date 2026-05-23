import { cn, Button as UIButton } from "@voila/ui";
import type { ComponentProps } from "react";

/**
 * FormCard - thin layout wrapper used by every detail input card.
 *
 * Composition: `Root > Form > Body + Footer`. The visual frame is split so
 * the footer (where the Save button lives) reads as a separate row with its
 * own background.
 */

function Root(props: ComponentProps<"section">) {
  return <section {...props} />;
}

function Form(props: ComponentProps<"form">) {
  return <form {...props} />;
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-t-lg border-x border-t bg-card p-6 text-card-foreground", className)}
      {...props}
    />
  );
}

function Title({ className, ...props }: ComponentProps<"h4">) {
  return <h4 className={cn("font-semibold text-xl", className)} {...props} />;
}

function Description({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("my-3 text-xs", className)} {...props} />;
}

function Footer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-b-lg border bg-muted px-6 py-3 text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

function FooterDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-xs", className)} {...props} />;
}

function Button(props: ComponentProps<typeof UIButton>) {
  return <UIButton size="sm" {...props} />;
}

export const FormCard = {
  Root,
  Form,
  Body,
  Title,
  Description,
  Footer,
  FooterDescription,
  Button,
};
