// ConfirmButton — a trigger that asks "are you sure?" in an `@voila/ui`
// AlertDialog before running an action, for destructive, one-click operations
// like delete. The host wires `onConfirm` to the real mutation; the dialog
// guards it. Router-agnostic and presentational, like the rest of content-ui:
// the trigger styles itself from the `variant`, and the caller controls the
// pending/disabled state (e.g. `disabled` while the mutation runs).

import { AlertDialog } from "@voila/ui/alert-dialog";
import { buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import type { ReactNode } from "react";

export interface ConfirmButtonProps {
  /** The trigger's content (e.g. "Delete"). */
  readonly children: ReactNode;
  /** Heading of the confirmation dialog. */
  readonly title?: ReactNode;
  /** Body text explaining the consequence (e.g. "This can't be undone."). */
  readonly description?: ReactNode;
  /** Label of the confirming action. Defaults to the trigger's text when a
   *  string, else "Confirm". */
  readonly confirmLabel?: ReactNode;
  readonly cancelLabel?: ReactNode;
  /** Run when the user confirms (the dialog closes either way). */
  readonly onConfirm: () => void;
  /** Disables the trigger (e.g. while the confirmed action is in flight). */
  readonly disabled?: boolean;
  /** Visual intent of the trigger and the confirm button. Defaults to
   *  `destructive` — the common case for a confirmation. */
  readonly variant?: "destructive" | "default";
  /** Classes for the trigger, layered over the variant's button styles. */
  readonly className?: string;
}

export function ConfirmButton({
  children,
  title = "Are you sure?",
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  disabled,
  variant = "destructive",
  className,
}: ConfirmButtonProps): ReactNode {
  const confirmText = confirmLabel ?? (typeof children === "string" ? children : "Confirm");
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        disabled={disabled}
        className={cn(buttonVariants({ variant, size: "sm" }), className)}
      >
        {children}
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          {description ? <AlertDialog.Description>{description}</AlertDialog.Description> : null}
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>{cancelLabel}</AlertDialog.Cancel>
          <AlertDialog.Action variant={variant} onClick={onConfirm}>
            {confirmText}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
