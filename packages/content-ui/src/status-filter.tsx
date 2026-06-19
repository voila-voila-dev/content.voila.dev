// StatusFilter — a segmented control scoping a draft-enabled collection's list
// to a publish state: All / Published / Scheduled / Drafts. Presentational and
// router-agnostic: the host holds the selected value, refetches with
// `client.<slug>.list({ status })`, and feeds the page back into the table.
// The values mirror the engine's `DraftFilter` (`any` = every row).

import { Tabs } from "@voila/ui";
import type { ReactNode } from "react";

export type StatusFilterValue = "any" | "published" | "scheduled" | "draft";

const OPTIONS: ReadonlyArray<{ readonly value: StatusFilterValue; readonly label: string }> = [
  { value: "any", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
];

export interface StatusFilterProps {
  readonly value: StatusFilterValue;
  readonly onChange: (value: StatusFilterValue) => void;
  /** Disable the control (e.g. while a page is loading). */
  readonly disabled?: boolean;
}

export function StatusFilter({ value, onChange, disabled = false }: StatusFilterProps): ReactNode {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(next as StatusFilterValue)}>
      <Tabs.List>
        {OPTIONS.map((option) => (
          <Tabs.Trigger key={option.value} value={option.value} disabled={disabled}>
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
