import { Avatar as BaseAvatar } from "@base-ui-components/react/avatar";
import type * as React from "react";
import { cn } from "#lib/cn";

function Root({ className, ...props }: React.ComponentProps<typeof BaseAvatar.Root>) {
  return (
    <BaseAvatar.Root
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

function Image({ className, ...props }: React.ComponentProps<typeof BaseAvatar.Image>) {
  return <BaseAvatar.Image className={cn("aspect-square h-full w-full", className)} {...props} />;
}

function Fallback({ className, ...props }: React.ComponentProps<typeof BaseAvatar.Fallback>) {
  return (
    <BaseAvatar.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export const Avatar = { Root, Image, Fallback };
