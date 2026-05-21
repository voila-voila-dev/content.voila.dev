import { Progress as BaseProgress } from "@base-ui-components/react/progress";
import type * as React from "react";
import { cn } from "#lib/cn";

export function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof BaseProgress.Root>) {
  return (
    <BaseProgress.Root
      value={value}
      className={cn("relative w-full overflow-hidden", className)}
      {...props}
    >
      <BaseProgress.Track className="block h-2 w-full overflow-hidden rounded-full bg-primary/20">
        <BaseProgress.Indicator className="block h-full bg-primary transition-all" />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}
