import { cn } from "@voila/ui";
import type { ComponentProps, ComponentType, ReactNode } from "react";

/**
 * Empty state shown when a list query returns zero rows or a detail/singleton
 * record doesn't exist yet. Composable so callers can drop in an action
 * button when the write path lands in M2.
 */
export interface EmptyStateProps extends ComponentProps<"div"> {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-8 text-muted-foreground" /> : null}
      <div className="grid gap-1">
        <h3 className="font-medium text-base">{title}</h3>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
