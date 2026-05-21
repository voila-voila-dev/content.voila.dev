import { MinusIcon } from "@phosphor-icons/react";
import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";
import { cn } from "#lib/cn";

function Root({ className, containerClassName, ...props }: React.ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function Group({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center", className)} {...props} />;
}

function Slot({ index, className, ...props }: React.ComponentProps<"div"> & { index: number }) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const slot = inputOTPContext.slots[index];
  const char = slot?.char;
  const hasFakeCaret = slot?.hasFakeCaret;
  const isActive = slot?.isActive;
  return (
    <div
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function Separator(props: React.ComponentProps<"div">) {
  return (
    <div aria-hidden="true" {...props}>
      <MinusIcon />
    </div>
  );
}

export const InputOTP = { Root, Group, Slot, Separator };
