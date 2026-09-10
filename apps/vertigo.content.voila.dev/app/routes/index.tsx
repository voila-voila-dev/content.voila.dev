// The marquee. What is on this week, three films worth making a trip for, the
// most recent piece of writing, and how to find the place.

import { createFileRoute, Link } from "@tanstack/react-router";
import { FilmTile } from "../components/film-grid";
import { Empty, Eyebrow, MetaLine, SectionHead } from "../components/primitives";
import { RichText } from "../components/rich-text";
import { DayBlock } from "../components/screenings";
import { dateMedium } from "../lib/format";
import { type Lang, langSearch, strings } from "../lib/i18n";
import { fetchHome } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchHome({ data: { lang: deps.lang } }),
  component: Home,
});

function Home() {
  const { week, featured, latest, settings } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);
  const search = langSearch(lang);
  const count = week.reduce((total, day) => total + day.screenings.length, 0);

  return (
    <div className="pb-8">
      {/* Hero: the tagline the cinema writes about itself, set large. */}
      <section className="border-b border-rule py-14 sm:py-20">
        <Eyebrow>{settings?.address?.split("\n")[0] ?? "Lisboa"}</Eyebrow>
        <h1 className="mt-6 max-w-5xl font-display text-[clamp(2.6rem,8.5vw,6rem)] font-medium leading-[0.94] tracking-tight">
          {settings?.tagline ?? "Restored classics and new arthouse, seven nights a week."}
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            to="/programme"
            search={search}
            className="inline-block border border-(--accent) px-5 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-(--accent) transition-colors hover:bg-(--accent) hover:text-[#0b0a09]"
          >
            {t.allScreenings}
          </Link>
          {count > 0 ? (
            <p className="text-sm text-dim">
              {count} {t.screenings} · {t.thisWeekBlurb}
            </p>
          ) : null}
        </div>
      </section>

      {/* This week */}
      <section className="py-14">
        <SectionHead
          label={t.thisWeek}
          action={
            <Link
              to="/programme"
              search={search}
              className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-dim transition-colors hover:text-(--accent)"
            >
              {t.allScreenings} →
            </Link>
          }
        />
        <div className="mt-10 space-y-12">
          {week.length === 0 ? (
            <Empty>{t.nothingScheduled}</Empty>
          ) : (
            week.map((day) => <DayBlock key={day.key} day={day} lang={lang} />)
          )}
        </div>
      </section>

      {/* Featured films */}
      {featured.length > 0 ? (
        <section className="py-14">
          <SectionHead
            label={t.featured}
            action={
              <Link
                to="/films"
                search={search}
                className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-dim transition-colors hover:text-(--accent)"
              >
                {t.allFilms} →
              </Link>
            }
          />
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {featured.map((film) => (
              <FilmTile key={film.id} film={film} lang={lang} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Latest journal entry */}
      {latest ? (
        <section className="py-14">
          <SectionHead
            label={t.fromTheJournal}
            action={
              <Link
                to="/journal"
                search={search}
                className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-dim transition-colors hover:text-(--accent)"
              >
                {t.journal} →
              </Link>
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
            <MetaLine
              className="md:pt-3"
              items={[
                latest.publishedAt ? dateMedium(latest.publishedAt, lang) : null,
                latest.author ? `${t.by} ${latest.author.name}` : null,
              ]}
            />
            <div>
              <h2 className="font-display text-[clamp(1.8rem,4.4vw,3rem)] leading-[1.05]">
                <Link
                  to="/journal/$slug"
                  params={{ slug: latest.slug }}
                  search={search}
                  className="transition-colors hover:text-(--accent)"
                >
                  {latest.title}
                </Link>
              </h2>
              {latest.excerpt ? (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-dim">
                  {latest.excerpt}
                </p>
              ) : null}
              <Link
                to="/journal/$slug"
                params={{ slug: latest.slug }}
                search={search}
                className="mt-6 inline-block text-[0.68rem] font-medium uppercase tracking-[0.2em] text-(--accent)"
              >
                {t.readMore} →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Visit */}
      <section className="py-14">
        <SectionHead
          label={t.visit}
          action={
            <Link
              to="/visit"
              search={search}
              className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-dim transition-colors hover:text-(--accent)"
            >
              {t.findUs} →
            </Link>
          }
        />
        <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr] md:gap-16">
          {settings?.about ? (
            <RichText value={settings.about} />
          ) : (
            <p className="max-w-2xl text-base leading-relaxed text-dim">{t.thisWeekBlurb}</p>
          )}
          <dl className="space-y-6 text-sm">
            <div>
              <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
                {t.address}
              </dt>
              <dd className="mt-2 whitespace-pre-line text-dim">{settings?.address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
                {t.openingHours}
              </dt>
              <dd className="mt-2 whitespace-pre-line text-dim">{settings?.openingHours ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
