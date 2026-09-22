// DisclosureRows — the read-mode counterpart of `SortableList`: one collapsed
// row per record (an optional badge, a one-line summary, a caret) that opens
// to the record's fields. Native `<details>`, so the read view carries no
// state and a long rich-text body stays out of the way until asked for.
// Used by the blocks and object-array displays; the editor's rows look the
// same, so a document reads alike whether or not it is being edited.

import { CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export interface DisclosureRow {
  readonly key: string;
  readonly badge?: ReactNode;
  readonly summary?: string;
  /** The expanded body (the record's rows). */
  readonly body: ReactNode;
}

export interface DisclosureRowsProps {
  readonly slot: string;
  readonly rows: ReadonlyArray<DisclosureRow>;
}

export function DisclosureRows({ slot, rows }: DisclosureRowsProps): ReactNode {
  return (
    <ol data-slot={slot} className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} data-slot="disclosure-row">
          <details className="group rounded-md border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-ring">
              {row.badge}
              {row.summary ? (
                <span className="min-w-0 truncate text-muted-foreground text-sm">
                  {row.summary}
                </span>
              ) : null}
              <CaretDownIcon
                aria-hidden
                className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t px-4 py-3">{row.body}</div>
          </details>
        </li>
      ))}
    </ol>
  );
}
