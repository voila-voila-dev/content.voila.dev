import { cn } from "@voila/ui";
import type { ReactNode } from "react";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border-b border-border/40 px-4 py-20 sm:px-6 sm:py-24 lg:px-8",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-primary/90">{children}</p>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function SectionLead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg",
        className,
      )}
    >
      {children}
    </p>
  );
}
