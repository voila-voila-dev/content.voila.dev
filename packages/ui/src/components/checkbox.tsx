import { Checkbox as BaseCheckbox } from "@base-ui-components/react/checkbox";
import { CheckIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex items-center justify-center text-current">
        <CheckIcon className="h-4 w-4" weight="bold" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
