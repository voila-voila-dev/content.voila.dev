import { Accordion as BaseAccordion } from "@base-ui-components/react/accordion";
import { CaretDownIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

const Root = BaseAccordion.Root;

function Item({ className, ...props }: React.ComponentProps<typeof BaseAccordion.Item>) {
  return <BaseAccordion.Item className={cn("border-b", className)} {...props} />;
}

function Trigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Trigger>) {
  return (
    <BaseAccordion.Header className="flex">
      <BaseAccordion.Trigger
        className={cn(
          "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-panel-open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <CaretDownIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

function Content({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Panel>) {
  return (
    <BaseAccordion.Panel
      className="overflow-hidden text-sm transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0"
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </BaseAccordion.Panel>
  );
}

export const Accordion = { Root, Item, Trigger, Content };
