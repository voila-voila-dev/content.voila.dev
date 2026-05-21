import { ToggleGroup as BaseToggleGroup } from "@base-ui-components/react/toggle-group";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Toggle, type toggleVariants } from "#components/toggle";
import { cn } from "#lib/cn";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

function Root({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof BaseToggleGroup> & VariantProps<typeof toggleVariants>) {
  return (
    <BaseToggleGroup className={cn("flex items-center justify-center gap-1", className)} {...props}>
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </BaseToggleGroup>
  );
}

function Item({ className, variant, size, ...props }: React.ComponentProps<typeof Toggle>) {
  const ctx = React.useContext(ToggleGroupContext);
  return (
    <Toggle
      variant={ctx.variant ?? variant}
      size={ctx.size ?? size}
      className={className}
      {...props}
    />
  );
}

export const ToggleGroup = { Root, Item };
