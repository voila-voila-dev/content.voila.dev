// NestedFields — the field map INSIDE a structured value: one block's fields,
// an object's members. Renders each field through `FieldRow` + the edit widget
// resolved from the registry in scope (`useEditRegistry`), so the host's
// injected media / relation / rich-text widgets apply at any depth. Edits are
// merged into the record and emitted whole; errors come in as `FieldIssue`s
// relative to the record and are placed by key. `NestedDisplayRows` is the
// read-side twin (a `<dl>` of label → rendered value) for detail views.

import type { Field, FieldsMap } from "@voila/content";
import type { ReactNode } from "react";
import { FieldRenderer } from "./field-renderer";
import { FieldRow } from "./field-row";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";
import { type FieldIssue, issueMessageAt, issuesUnder } from "./lib/validate";
import { useEditRegistry } from "./registry/context";
import { resolveEditWidget } from "./registry/edit";

/** `n / max` for a bounded string, when the field declares a `max`. */
function charCount(value: unknown, meta: { max?: number }): string | undefined {
  if (typeof meta.max !== "number" || typeof value !== "string") return undefined;
  return `${value.length} / ${meta.max}`;
}

/** The keys a nested map renders: every field not marked `hidden`. */
export function visibleKeys(fields: FieldsMap): string[] {
  return Object.keys(fields).filter((key) => fields[key]?.meta.hidden !== true);
}

export interface NestedFieldsProps {
  readonly fields: FieldsMap;
  readonly value: Readonly<Doc> | undefined;
  /** Receives the whole record with the edited member replaced. */
  readonly onChange: (next: Readonly<Doc>) => void;
  /** Controls are `${idPrefix}-${key}`. */
  readonly idPrefix: string;
  /** Issues relative to this record. */
  readonly issues?: ReadonlyArray<FieldIssue>;
  readonly disabled?: boolean;
}

export function NestedFields({
  fields,
  value,
  onChange,
  idPrefix,
  issues,
  disabled,
}: NestedFieldsProps): ReactNode {
  const registry = useEditRegistry();
  const record = value ?? {};
  return (
    <div data-slot="nested-fields" className="space-y-4">
      {visibleKeys(fields).map((key) => {
        const field = fields[key] as Field;
        const id = `${idPrefix}-${key}`;
        const Widget = resolveEditWidget(field.meta, registry);
        return (
          <FieldRow
            key={key}
            id={id}
            label={getFieldLabel(key, field)}
            required={field.meta.required === true}
            count={charCount(record[key], field.meta as { max?: number })}
            help={field.meta.description}
            error={issueMessageAt(issues, [key])}
          >
            <Widget
              value={record[key]}
              onChange={(v) => {
                // Widgets may hand back a functional updater (the localized
                // editor does); resolve it against the current member.
                const next =
                  typeof v === "function" ? (v as (p: unknown) => unknown)(record[key]) : v;
                onChange({ ...record, [key]: next });
              }}
              field={field}
              id={id}
              labelId={`${id}-label`}
              error={issueMessageAt(issues, [key])}
              issues={issuesUnder(issues, key)}
              disabled={disabled}
            />
          </FieldRow>
        );
      })}
    </div>
  );
}

export interface NestedDisplayRowsProps {
  readonly fields: FieldsMap;
  readonly value: unknown;
}

/** Read mode for a nested record: a compact `<dl>` of label → rendered value. */
export function NestedDisplayRows({ fields, value }: NestedDisplayRowsProps): ReactNode {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Readonly<Doc>)
      : {};
  return (
    <dl
      data-slot="nested-display"
      className="grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-4 gap-y-2"
    >
      {visibleKeys(fields).map((key) => {
        const field = fields[key] as Field;
        return (
          <div key={key} className="contents">
            <dt className="pt-0.5 font-medium text-muted-foreground text-xs leading-5">
              {getFieldLabel(key, field)}
            </dt>
            <dd className="min-w-0 text-sm [&_.voila-rich-text]:min-h-0 [&_.voila-rich-text]:p-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
              <FieldRenderer field={field} value={record[key]} context="detail" />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
