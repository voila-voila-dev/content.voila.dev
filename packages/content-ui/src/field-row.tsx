// FieldRow — the chrome around one edit widget: label (with the required
// marker), optional character count, the widget itself, help text, and the
// inline error. `CollectionForm` renders every top-level field through it and
// `NestedFields` reuses it inside blocks / objects, so a nested title looks
// exactly like a top-level one. Purely presentational — the widget is `children`.

import { Label } from "@voila.dev/ui/label";
import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";

export interface FieldRowProps {
  /** The control's DOM id; the label, help and error ids derive from it. */
  readonly id: string;
  /** Override the label's `htmlFor` (a localized field points at its first locale input). */
  readonly htmlFor?: string;
  readonly label: ReactNode;
  readonly required?: boolean;
  /** `12 / 200` for a bounded string. */
  readonly count?: string;
  /** The field's `meta.description`, rendered under the widget as `${id}-description`. */
  readonly help?: string;
  /** Rendered as `${id}-error` with `role="alert"` unless `hideError`. */
  readonly error?: string;
  /** Suppress the field-level message (a localized field shows per-locale ones). */
  readonly hideError?: boolean;
  /** Marks the row as edited (`data-dirty`), a hook for tests and debugging. */
  readonly dirty?: boolean;
  /** Extra content after the error slot (the per-field Save row). */
  readonly trailer?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function FieldRow({
  id,
  htmlFor = id,
  label,
  required,
  count,
  help,
  error,
  hideError,
  dirty,
  trailer,
  className,
  children,
}: FieldRowProps): ReactNode {
  return (
    <div
      data-slot="form-field"
      data-dirty={dirty || undefined}
      className={cn("space-y-1.5", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label id={`${id}-label`} htmlFor={htmlFor}>
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {count ? (
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="off">
            {count}
          </span>
        ) : null}
      </div>
      {children}
      {help ? (
        <p id={`${id}-description`} className="text-muted-foreground text-xs">
          {help}
        </p>
      ) : null}
      {error && !hideError ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {trailer}
    </div>
  );
}
