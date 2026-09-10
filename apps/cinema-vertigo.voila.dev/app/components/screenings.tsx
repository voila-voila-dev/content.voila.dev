// The programme itself: a day, and the showings under it. Laid out the way a
// printed listing is — the date in the left margin, times as the strongest
// vertical rhythm on the page, everything else hanging off them.

import { Link } from "@tanstack/react-router";
import { dayNumber, monthShort, time, weekday } from "../lib/format";
import { type Lang, langSearch, strings } from "../lib/i18n";
import type { DayGroup, ScreeningCard } from "../lib/queries";
import { Badge } from "./primitives";

function ScreeningRow({ screening, lang }: { screening: ScreeningCard; lang: Lang }) {
  const t = strings(lang);
  const film = screening.film;
  const meta = [screening.screen, screening.presentation].filter(
    (v): v is string => typeof v === "string",
  );

  return (
    <article className="grid grid-cols-[3.6rem_1fr] gap-x-4 gap-y-2 border-t border-rule py-5 sm:grid-cols-[5rem_1fr_auto] sm:gap-x-6">
      <p className="font-display text-xl leading-none tabular-nums sm:text-2xl">
        {time(screening.startsAt, lang)}
      </p>

      <div className="min-w-0">
        <h3 className="font-display text-[clamp(1.25rem,2.6vw,1.75rem)] leading-tight">
          {film ? (
            <Link
              to="/films/$slug"
              params={{ slug: film.slug }}
              search={langSearch(lang)}
              className="transition-colors hover:text-(--accent)"
            >
              {screening.label}
            </Link>
          ) : (
            screening.label
          )}
        </h3>
        {film ? (
          <p className="mt-1 text-sm text-faint">
            {[
              film.year,
              film.country,
              film.certificate ? `${t.certificate} ${film.certificate}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {screening.host ? (
          <p className="mt-1 text-sm text-dim">
            {t.by}{" "}
            <Link
              to="/people/$slug"
              params={{ slug: screening.host.slug }}
              search={langSearch(lang)}
              className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
            >
              {screening.host.name}
            </Link>
          </p>
        ) : null}
        {screening.note ? (
          <p className="mt-2 max-w-prose text-sm text-dim">{screening.note}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {meta.map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
          {screening.soldOut ? <Badge tone="accent">{t.soldOut}</Badge> : null}
        </div>
      </div>

      <div className="col-start-2 sm:col-start-3 sm:self-center">
        {screening.soldOut || !screening.ticketUrl ? null : (
          <a
            href={screening.ticketUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-block border border-(--accent) px-4 py-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-(--accent) transition-colors hover:bg-(--accent) hover:text-[#0b0a09]"
          >
            {t.bookTickets}
          </a>
        )}
      </div>
    </article>
  );
}

export function DayBlock({ day, lang }: { day: DayGroup; lang: Lang }) {
  return (
    <section className="grid gap-4 border-t-2 border-rule-strong pt-6 md:grid-cols-[10rem_1fr] md:gap-10">
      <header className="md:sticky md:top-8 md:self-start">
        <p className="font-display text-[clamp(2.6rem,6vw,3.6rem)] leading-none tabular-nums">
          {dayNumber(day.startsAt, lang)}
        </p>
        <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-(--accent)">
          {monthShort(day.startsAt, lang)}
        </p>
        <p className="mt-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-faint">
          {weekday(day.startsAt, lang)}
        </p>
      </header>
      <div>
        {day.screenings.map((screening) => (
          <ScreeningRow key={screening.id} screening={screening} lang={lang} />
        ))}
      </div>
    </section>
  );
}

/** A compact line used where a full row would be too much (the film page). */
export function ScreeningLine({ screening, lang }: { screening: ScreeningCard; lang: Lang }) {
  const t = strings(lang);
  return (
    <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-rule py-3">
      <span className="font-display text-lg tabular-nums">
        {dayNumber(screening.startsAt, lang)} {monthShort(screening.startsAt, lang)}
      </span>
      <span className="font-display text-lg tabular-nums text-(--accent)">
        {time(screening.startsAt, lang)}
      </span>
      <span className="text-sm text-dim">
        {[weekday(screening.startsAt, lang), screening.screen, screening.presentation]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="ml-auto flex items-center gap-2">
        {screening.soldOut ? (
          <Badge tone="accent">{t.soldOut}</Badge>
        ) : screening.ticketUrl ? (
          <a
            href={screening.ticketUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-(--accent) underline underline-offset-4"
          >
            {t.bookTickets}
          </a>
        ) : null}
      </span>
    </li>
  );
}
