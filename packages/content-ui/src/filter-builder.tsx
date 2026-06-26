// FilterBuilder — author server-side list filters (`field op value`, AND-ed). A
// popover with one row per filter: a field picker, an operator, and a
// kind-appropriate value input, plus add/remove. Presentational and controlled:
// the host holds the applied filters (e.g. a saved view's `config.filters`) and
// feeds them to `client.<slug>.list({ filters })`. Only *complete* rows
// (a value present) are emitted, so a half-typed row never fires a query; an
// incomplete row stays in the popover until it's filled in.
//
// The offered fields + operators mirror the server's filter gate (scalar,
// non-localized columns; `contains` for text, comparisons for numbers/dates), so
// the admin can't author a filter the REST layer would 400.

import type { Collection, Field } from "@voila/content";
import type { FilterOp, ListFilter } from "@voila/content/client";
import { buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { FunnelIcon, PlusIcon, XIcon } from "@voila/ui/icons";
import { Popover } from "@voila/ui/popover";
import { type ReactNode, useRef, useState } from "react";
import { getFieldLabel } from "./lib/humanize";
import { selectOptions } from "./widgets/edit";

export interface FilterBuilderProps {
  readonly collection: Collection;
  /** The applied filters (controlled). */
  readonly value: ReadonlyArray<ListFilter>;
  /** Emits the next set of *complete* filters whenever a row changes. */
  readonly onChange: (filters: ListFilter[]) => void;
  /** Trigger label. Defaults to "Filters". */
  readonly label?: string;
}

// Scalar, filterable kinds — the server's `SORTABLE_KINDS`, minus the sensitive
// secret/password kinds we don't surface for filtering.
const TEXTUAL = new Set(["string", "slug", "id", "color", "code", "markdown"]);
const NUMERIC = new Set(["number", "position", "duration"]);
const TEMPORAL = new Set(["date", "datetime", "time"]);
const ENUMERATED = new Set(["enum", "select"]);
const FILTERABLE = new Set([...TEXTUAL, ...NUMERIC, ...TEMPORAL, ...ENUMERATED, "boolean"]);

const OP_LABELS: Record<FilterOp, string> = {
  eq: "is",
  ne: "is not",
  contains: "contains",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

/** The operators that make sense for a field kind. */
function opsForKind(kind: string): FilterOp[] {
  if (TEXTUAL.has(kind)) return ["eq", "ne", "contains"];
  if (NUMERIC.has(kind) || TEMPORAL.has(kind)) return ["eq", "ne", "gt", "gte", "lt", "lte"];
  return ["eq", "ne"];
}

const NATIVE_SELECT_CLASS =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface FilterableField {
  readonly key: string;
  readonly label: string;
  readonly field: Field;
}

/** The collection's filterable fields (non-hidden, non-localized, scalar). */
function filterableFields(collection: Collection): FilterableField[] {
  return Object.keys(collection.fields).flatMap((key) => {
    const field = collection.fields[key];
    if (!field || field.meta.hidden || field.meta.localized) return [];
    return FILTERABLE.has(field.meta.kind)
      ? [{ key, label: getFieldLabel(key, field), field }]
      : [];
  });
}

// A row is edited as strings (the form of every native control); `toFilter`
// converts it to a typed `ListFilter` and drops incomplete rows. `id` is a stable
// React key so removing a middle row doesn't re-key the inputs below it.
interface DraftRow {
  readonly id: string;
  readonly field: string;
  readonly op: FilterOp;
  readonly value: string;
}

/** A stable string form of the applied filters, to detect external resets. */
function signature(filters: ReadonlyArray<{ field: string; op: string; value: unknown }>): string {
  return JSON.stringify(filters.map((f) => [f.field, f.op, f.value]));
}

function kindOf(collection: Collection, key: string): string {
  return collection.fields[key]?.meta.kind ?? "string";
}

/** Default value for a freshly-picked field: booleans/enums start complete. */
function defaultValue(collection: Collection, key: string): string {
  const kind = kindOf(collection, key);
  if (kind === "boolean") return "true";
  if (ENUMERATED.has(kind)) {
    const field = collection.fields[key];
    return field ? (selectOptions(field.meta)[0]?.value ?? "") : "";
  }
  return "";
}

/** Convert a draft row to a typed filter, or `null` when it's incomplete. */
function toFilter(collection: Collection, row: DraftRow): ListFilter | null {
  const kind = kindOf(collection, row.field);
  if (kind === "boolean") return { field: row.field, op: row.op, value: row.value === "true" };
  if (row.value === "") return null;
  if (NUMERIC.has(kind)) {
    const n = Number(row.value);
    return Number.isNaN(n) ? null : { field: row.field, op: row.op, value: n };
  }
  return { field: row.field, op: row.op, value: row.value };
}

/** Seed editable rows from the applied filters (coerce values back to strings). */
function toDraft(value: ReadonlyArray<ListFilter>, mintId: () => string): DraftRow[] {
  return value.map((f) => ({ id: mintId(), field: f.field, op: f.op, value: String(f.value) }));
}

export function FilterBuilder({
  collection,
  value,
  onChange,
  label = "Filters",
}: FilterBuilderProps): ReactNode {
  const triggerLabel = value.length > 0 ? `${label} (${value.length})` : label;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          buttonVariants({ variant: value.length > 0 ? "secondary" : "outline", size: "sm" }),
          "gap-1.5",
        )}
      >
        <FunnelIcon className="size-4" aria-hidden />
        {triggerLabel}
      </Popover.Trigger>
      <Popover.Content align="end" className="w-[22rem] space-y-2">
        <FilterEditor collection={collection} value={value} onChange={onChange} label={label} />
      </Popover.Content>
    </Popover.Root>
  );
}

/**
 * The filter rows + add button, *without* the popover chrome. Used directly when
 * the editor must live inside another floating layer (e.g. the view-edit
 * dialog), where nesting a Base UI popover inside a Base UI dialog would render
 * it behind the backdrop. Same controlled contract as {@link FilterBuilder}.
 */
export function FilterEditor({
  collection,
  value,
  onChange,
  label = "Filters",
}: FilterBuilderProps): ReactNode {
  const fields = filterableFields(collection);
  const idRef = useRef(0);
  const mintId = () => `f${idRef.current++}`;
  const [rows, setRows] = useState<DraftRow[]>(() => toDraft(value, mintId));
  const [lastSig, setLastSig] = useState(() => signature(value));
  const incoming = signature(value);
  if (incoming !== lastSig) {
    setRows(toDraft(value, mintId));
    setLastSig(incoming);
  }

  function commit(next: DraftRow[]) {
    setRows(next);
    const applied = next.flatMap((row) => {
      const filter = toFilter(collection, row);
      return filter ? [filter] : [];
    });
    setLastSig(signature(applied));
    onChange(applied);
  }

  function addRow() {
    const first = fields[0];
    if (!first) return;
    commit([
      ...rows,
      {
        id: mintId(),
        field: first.key,
        op: opsForKind(first.field.meta.kind)[0] ?? "eq",
        value: defaultValue(collection, first.key),
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function changeField(index: number, key: string) {
    const kind = kindOf(collection, key);
    updateRow(index, {
      field: key,
      op: opsForKind(kind)[0] ?? "eq",
      value: defaultValue(collection, key),
    });
  }

  function removeRow(index: number) {
    commit(rows.filter((_, i) => i !== index));
  }

  return (
    <>
      <p className="font-medium text-sm">{label}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No filters yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-1.5">
              <select
                aria-label="Filter field"
                className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1")}
                value={row.field}
                onChange={(event) => changeField(index, event.target.value)}
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter operator"
                className={NATIVE_SELECT_CLASS}
                value={row.op}
                onChange={(event) => updateRow(index, { op: event.target.value as FilterOp })}
              >
                {opsForKind(kindOf(collection, row.field)).map((op) => (
                  <option key={op} value={op}>
                    {OP_LABELS[op]}
                  </option>
                ))}
              </select>
              <FilterValueInput
                collection={collection}
                fieldKey={row.field}
                value={row.value}
                onChange={(v) => updateRow(index, { value: v })}
              />
              <button
                type="button"
                aria-label="Remove filter"
                onClick={() => removeRow(index)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={addRow}
        disabled={fields.length === 0}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        <PlusIcon className="size-4" aria-hidden />
        Add filter
      </button>
    </>
  );
}

/** A value input matched to the field's kind (the form every native control takes). */
function FilterValueInput({
  collection,
  fieldKey,
  value,
  onChange,
}: {
  readonly collection: Collection;
  readonly fieldKey: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): ReactNode {
  const field = collection.fields[fieldKey];
  const kind = field?.meta.kind ?? "string";
  const common = {
    "aria-label": "Filter value",
    className: cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1"),
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };

  if (kind === "boolean") {
    return (
      <select {...common}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (field && ENUMERATED.has(kind)) {
    return (
      <select {...common}>
        {selectOptions(field.meta).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  const type = NUMERIC.has(kind)
    ? "number"
    : kind === "date"
      ? "date"
      : kind === "datetime"
        ? "datetime-local"
        : kind === "time"
          ? "time"
          : "text";
  return <input {...common} type={type} />;
}
