// LocaleSwitcher — picks which translation a form is editing.
//
// A localized field stores `Record<locale, T>`, and the editor used to render
// every locale stacked under every field. With two locales that doubles a
// form's height; with five it makes it unusable, and it buries the locale an
// editor actually works in among four they don't. One switcher at the top of
// the form replaces all of that: the form shows one language at a time, and the
// switcher carries a completion dot per locale so nothing goes missing quietly.

import { SegmentedControl } from "@voila.dev/ui/segmented-control";
import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";
import { useMessages } from "./lib/messages";

/** How translated one locale is across the form's localized fields. */
export interface LocaleProgress {
  readonly locale: string;
  /** Localized fields carrying a value in this locale. */
  readonly filled: number;
  /** Localized fields rendered by the form. */
  readonly total: number;
}

export interface LocaleSwitcherProps {
  readonly locales: ReadonlyArray<string>;
  readonly value: string;
  readonly onChange: (locale: string) => void;
  /** The locale reads fall back to; marked as the source translation. */
  readonly defaultLocale?: string;
  /** Per-locale completion, keyed by locale. Omit to hide the dots. */
  readonly progress?: Readonly<Record<string, LocaleProgress>>;
  readonly disabled?: boolean;
}

/** complete · started · empty — three states, so "nothing translated" is obvious. */
function completionState(progress: LocaleProgress | undefined): "full" | "partial" | "empty" {
  if (progress === undefined || progress.total === 0) return "full";
  if (progress.filled === 0) return "empty";
  return progress.filled >= progress.total ? "full" : "partial";
}

const DOT_CLASS: Record<"full" | "partial" | "empty", string> = {
  full: "bg-emerald-500",
  partial: "bg-amber-500",
  empty: "bg-muted-foreground/40",
};

export function LocaleSwitcher({
  locales,
  value,
  onChange,
  defaultLocale,
  progress,
  disabled,
}: LocaleSwitcherProps): ReactNode {
  const m = useMessages().shell;
  // One locale is not a choice — showing a switcher for it is pure noise.
  if (locales.length < 2) return null;
  return (
    <div
      data-slot="locale-switcher"
      className="flex flex-wrap items-center justify-between gap-2 pb-1"
    >
      <SegmentedControl.Root
        size="sm"
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
        aria-label={m.editingLanguage}
      >
        {locales.map((locale) => {
          const state = completionState(progress?.[locale]);
          const stats = progress?.[locale];
          return (
            <SegmentedControl.Item
              key={locale}
              value={locale}
              aria-label={stats ? m.localeProgress(locale, stats.filled, stats.total) : locale}
            >
              <span className="flex items-center gap-1.5">
                {progress ? (
                  <span
                    aria-hidden
                    data-state={state}
                    className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[state])}
                  />
                ) : null}
                <span className="font-mono text-xs">{locale}</span>
              </span>
            </SegmentedControl.Item>
          );
        })}
      </SegmentedControl.Root>
      {defaultLocale !== undefined && value !== defaultLocale ? (
        <span className="text-muted-foreground text-xs">
          {m.fallbackBefore}
          <span className="font-mono">{defaultLocale}</span>
          {m.fallbackAfter}
        </span>
      ) : null}
    </div>
  );
}
