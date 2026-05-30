// VENDED by @voila/content-registry — you own this file.
// Read-only renderer for a decoded document value (the typed client already
// decoded dates → `Date`, JSON → objects, booleans → `boolean`).
import { Badge } from "~/components/ui/badge";

export function FieldValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <Badge>{value ? "true" : "false"}</Badge>;
  }
  if (value instanceof Date) {
    return <span>{value.toLocaleString()}</span>;
  }
  if (typeof value === "object") {
    return <code className="text-xs">{JSON.stringify(value)}</code>;
  }
  return <span>{String(value)}</span>;
}
