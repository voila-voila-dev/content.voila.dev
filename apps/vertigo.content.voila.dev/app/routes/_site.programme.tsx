// The full calendar: every announced screening, grouped by date, filterable by
// screen. The filter lives in the URL (`?screen=Sala+Azul`) so a link to "what's
// on in the Sala Azul" is shareable and survives a reload; the filtering itself
// is client-side over data already in hand, since the whole programme is one
// page of rows and there is nothing to re-fetch.

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Empty, PageHeader } from "../components/primitives";
import { DayBlock } from "../components/screenings";
import { type Lang, strings } from "../lib/i18n";
import { fetchProgramme } from "../lib/queries";
import { useLang } from "../lib/use-lang";

interface ProgrammeSearch {
  readonly screen?: string;
}

export const Route = createFileRoute("/_site/programme")({
  // Adds to the root route's `?lang`; both are inherited by every link below.
  validateSearch: (search: Record<string, unknown>): ProgrammeSearch =>
    typeof search.screen === "string" && search.screen !== "" ? { screen: search.screen } : {},
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchProgramme({ data: { lang: deps.lang } }),
  component: Programme,
});

function Programme() {
  const { days, screens } = Route.useLoaderData();
  const { screen } = Route.useSearch();
  const lang = useLang();
  const t = strings(lang);

  // An unknown screen (a stale link, a renamed room) filters nothing away rather
  // than showing an empty programme.
  const active = screen && screens.includes(screen) ? screen : null;

  const filtered = active
    ? days
        .map((day) => ({ ...day, screenings: day.screenings.filter((s) => s.screen === active) }))
        .filter((day) => day.screenings.length > 0)
    : days;

  const total = filtered.reduce((sum, day) => sum + day.screenings.length, 0);

  return (
    <div className="pb-8">
      <PageHeader eyebrow={t.programme} title={t.allScreenings} lead={t.thisWeekBlurb} />

      {screens.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-rule py-5">
          <FilterChip screen={undefined} active={active === null}>
            {t.allScreens}
          </FilterChip>
          {screens.map((name) => (
            <FilterChip key={name} screen={name} active={active === name}>
              {name}
            </FilterChip>
          ))}
          <span className="ml-auto text-[0.62rem] uppercase tracking-[0.2em] text-faint">
            {total} {t.screenings}
          </span>
        </div>
      ) : null}

      <div className="mt-12 space-y-14">
        {filtered.length === 0 ? (
          <Empty>{t.nothingScheduled}</Empty>
        ) : (
          filtered.map((day) => <DayBlock key={day.key} day={day} lang={lang} />)
        )}
      </div>
    </div>
  );
}

/** A link, not a button: the filter is a location, so it should be linkable. */
function FilterChip({
  screen,
  active,
  children,
}: {
  screen: string | undefined;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to="/programme"
      // Keep whatever else is in the URL (the language) and swap the screen.
      search={(prev) => ({ ...prev, screen })}
      replace
      aria-current={active ? "true" : undefined}
      className={`border px-3.5 py-1.5 text-[0.64rem] font-medium uppercase tracking-[0.18em] transition-colors ${
        active
          ? "border-(--accent) bg-(--accent) text-[#0b0a09]"
          : "border-rule text-dim hover:border-rule-strong hover:text-bone"
      }`}
    >
      {children}
    </Link>
  );
}
