// SearchInput — a controlled full-text search box for a search-enabled
// collection. Presentational and router-agnostic: the host holds the query
// string, runs `client.<slug>.search(q)` (on change or on submit), and feeds the
// ranked rows back into the table. Submitting the form (Enter) calls `onSubmit`;
// `onChange` fires per keystroke so a host can debounce-and-search if it prefers.

import { Input } from "@voila.dev/ui/input";
import type { ReactNode } from "react";
import { useMessages } from "./lib/messages";

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
  placeholder,
  disabled = false,
}: SearchInputProps): ReactNode {
  const m = useMessages();
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
        placeholder={placeholder ?? m.shell.searchEllipsis}
        disabled={disabled}
        aria-label={m.common.search}
        onChange={(event) => onChange(event.target.value)}
      />
    </form>
  );
}
