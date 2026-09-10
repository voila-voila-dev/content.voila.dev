// A person: director, programmer, guest or writer. The page is the join —
// everything in the catalogue and the journal that points back at this record.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { FilmGrid } from "../components/film-grid";
import { JournalList } from "../components/journal-list";
import { Eyebrow, Poster, SectionHead } from "../components/primitives";
import { RichText } from "../components/rich-text";
import { coordinates } from "../lib/format";
import { type Lang, strings } from "../lib/i18n";
import { fetchPerson } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/_site/people/$slug")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: async ({ params, deps }) => {
    const payload = await fetchPerson({ data: { lang: deps.lang, slug: params.slug } });
    if (!payload) throw notFound();
    return payload;
  },
  head: ({ loaderData }) =>
    loaderData ? { meta: [{ title: `${loaderData.person.name} — Cinéma Vertigo` }] } : {},
  component: PersonPage,
});

function PersonPage() {
  const { person, films, entries } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);

  return (
    <div className="pb-8">
      <header className="grid gap-10 border-b border-rule py-10 sm:py-14 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="max-w-[15rem]">
          <Poster title={person.name} image={person.portrait} ratio="4 / 5" />
        </div>
        <div>
          {person.role ? <Eyebrow>{person.role}</Eyebrow> : null}
          <h1 className="mt-4 font-display text-[clamp(2.2rem,6.5vw,4.4rem)] font-medium leading-[0.95]">
            {person.name}
          </h1>
          {person.website ? (
            <a
              href={person.website}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-block text-[0.66rem] font-medium uppercase tracking-[0.18em] text-(--accent) underline underline-offset-4"
            >
              {person.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          {person.bornIn ? (
            <p className="mt-4 font-mono text-xs text-faint">{coordinates(person.bornIn)}</p>
          ) : null}
        </div>
      </header>

      {person.bio ? (
        <section className="py-12">
          <Eyebrow className="mb-6">{t.biography}</Eyebrow>
          <RichText value={person.bio} />
        </section>
      ) : null}

      {films.length > 0 ? (
        <section className="py-12">
          <SectionHead label={t.filmsDirected} />
          <div className="mt-10">
            <FilmGrid films={films} lang={lang} />
          </div>
        </section>
      ) : null}

      {entries.length > 0 ? (
        <section className="py-12">
          <SectionHead label={t.entriesWritten} />
          <div className="mt-6">
            <JournalList entries={entries} lang={lang} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
