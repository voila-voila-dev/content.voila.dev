import type { AnyFieldDef } from "@voila/content-schema";
import { cn } from "@voila/ui";
import type { ComponentProps, ReactNode } from "react";

/**
 * Read-only field renderers used by the detail + singleton views.
 *
 * One small switch per field `kind` keeps the value formatting honest about
 * what the column actually stores (Dates render as ISO strings, booleans as
 * Yes/No, JSON as pre-formatted blocks). Unknown kinds fall back to a string
 * coercion rather than throwing — extension packages can register their own
 * widgets in M2 without breaking the read path here.
 */

const EMPTY = "—";

export function formatFieldValue(field: AnyFieldDef, value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return EMPTY;
  switch (field.kind) {
    case "boolean":
      return value ? "Yes" : "No";
    case "datetime": {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    }
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "json":
      return (
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    default:
      return String(value);
  }
}

export interface ReadOnlyFieldProps extends ComponentProps<"div"> {
  field: AnyFieldDef;
  name: string;
  value: unknown;
}

export function ReadOnlyField({ field, name, value, className, ...props }: ReadOnlyFieldProps) {
  const label = field.label ?? name;
  return (
    <div className={cn("grid gap-1.5", className)} {...props}>
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm">{formatFieldValue(field, value)}</div>
      {field.description ? (
        <p className="text-muted-foreground text-xs">{field.description}</p>
      ) : null}
    </div>
  );
}
