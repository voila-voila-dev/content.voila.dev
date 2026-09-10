// One film. The page takes the film's own `accentColor` as its local accent —
// every rule, badge and link on it shifts to the colour of the poster — and
// gathers everything else the schema points at: the director, the upcoming
// dates, and whatever the journal has written about it.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { JournalRow } from "../components/journal-list";
import { Badge, Banner, Eyebrow, MetaLine, Poster, SectionHead } from "../components/primitives";
import { RichText } from "../components/rich-text";
import { ScreeningLine } from "../components/screenings";
import { coordinates } from "../lib/format";
import { type Lang, langSearch, strings } from "../lib/i18n";
import { fetchFilm } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/films/$slug")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: async ({ params, deps }) => {
    const payload = await fetchFilm({ data: { lang: deps.lang, slug: params.slug } });
    if (!payload) throw notFound();
    return payload;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.film.title} — Cinéma Vertigo` },
            ...(loaderData.film.synopsis
              ? [{ name: "description", content: loaderData.film.synopsis }]
              : []),
          ],
        }
      : {},
  component: FilmPage,
});

function FilmPage() {
  const { film, director, screenings, entries } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);
  const search = langSearch(lang);
  const accent = film.accentColor ? ({ "--accent": film.accentColor } as CSSProperties) : undefined;

  return (
    <div className="pb-8" style={accent}>
      {/* A wide still, when there is one — the page header a cinema would print. */}
      {film.still ? (
        <div className="mt-8">
          <Banner image={film.still} ratio="21 / 9" color={film.accentColor} />
        </div>
      ) : null}

      <header className="grid gap-10 border-b border-rule py-10 sm:py-14 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="max-w-[18rem]">
          <Poster
            title={film.title}
            year={film.year}
            image={film.poster}
            color={film.accentColor}
          />
        </div>
        <div>
          <Eyebrow>{t.films}</Eyebrow>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,6.5vw,4.4rem)] font-medium leading-[0.95]">
            {film.title}
          </h1>
          {film.originalTitle && film.originalTitle !== film.title ? (
            <p className="mt-3 font-display text-xl italic text-dim">{film.originalTitle}</p>
          ) : null}

          <MetaLine
            className="mt-6"
            items={[
              film.year ? String(film.year) : null,
              film.runtime ? `${film.runtime} ${t.minutes}` : null,
              film.country,
              film.certificate ? `${t.certificate} ${film.certificate}` : null,
            ]}
          />

          {director ? (
            <p className="mt-4 text-base">
              <span className="text-faint">{t.directedBy} </span>
              <Link
                to="/people/$slug"
                params={{ slug: director.slug }}
                search={search}
                className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
              >
                {director.name}
              </Link>
            </p>
          ) : null}

          {film.synopsis ? (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-dim">{film.synopsis}</p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {film.formats.map((format) => (
              <Badge key={format}>{format}</Badge>
            ))}
            {film.trailerUrl ? (
              <a
                href={film.trailerUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-(--accent) underline underline-offset-4"
              >
                {t.watchTrailer}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-12 py-12 md:grid-cols-[2fr_1fr] md:gap-16">
        <div>
          {film.notes ? (
            <>
              <Eyebrow className="mb-6">{t.programmeNote}</Eyebrow>
              <RichText value={film.notes} />
            </>
          ) : null}

          {entries.length > 0 ? (
            <section className="mt-16">
              <SectionHead label={t.writtenAbout} />
              <ul className="mt-6">
                {entries.map((entry) => (
                  <JournalRow key={entry.id} entry={entry} lang={lang} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="md:border-l md:border-rule md:pl-10">
          <Eyebrow className="mb-4">{t.upcomingScreenings}</Eyebrow>
          {screenings.length === 0 ? (
            <p className="border-t border-rule py-4 text-sm text-faint">{t.noUpcoming}</p>
          ) : (
            <ul>
              {screenings.map((screening) => (
                <ScreeningLine key={screening.id} screening={screening} lang={lang} />
              ))}
            </ul>
          )}

          {film.shotIn ? (
            <div className="mt-10">
              <Eyebrow className="mb-3">{t.shotIn}</Eyebrow>
              <p className="border-t border-rule pt-3 font-mono text-xs text-dim">
                {coordinates(film.shotIn)}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
