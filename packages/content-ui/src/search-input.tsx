// SearchInput — a controlled full-text search box for a search-enabled
// collection. Presentational and router-agnostic: the host holds the query
// string, runs `client.<slug>.search(q)` (on change or on submit), and feeds the
// ranked rows back into the table. Submitting the form (Enter) calls `onSubmit`;
// `onChange` fires per keystroke so a host can debounce-and-search if it prefers.

import { Input } from "@voila/ui";
import type { ReactNode } from "react";

export interface SearchInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Fired when the search form is submitted (Enter). Defaults to a no-op. */
  readonly onSubmit?: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search…",
  disabled = false,
}: SearchInputProps): ReactNode {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a search <form> is the role-bearing landmark here; the native <search> element wouldn't carry the submit semantics.
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Search"
        onChange={(event) => onChange(event.target.value)}
      />
    </form>
  );
}
