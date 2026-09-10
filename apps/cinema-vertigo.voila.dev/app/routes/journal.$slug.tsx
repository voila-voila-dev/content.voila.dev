// One journal entry, set as an essay: a narrow measure, a dated standfirst, and
// a link back to the film it was written about.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Badge, Banner, Eyebrow, Poster } from "../components/primitives";
import { RichText } from "../components/rich-text";
import { dateLong } from "../lib/format";
import { type Lang, langSearch, strings } from "../lib/i18n";
import { fetchEntry } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/journal/$slug")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: async ({ params, deps }) => {
    const payload = await fetchEntry({ data: { lang: deps.lang, slug: params.slug } });
    if (!payload) throw notFound();
    return payload;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.entry.title} — Cinéma Vertigo` },
            ...(loaderData.entry.excerpt
              ? [{ name: "description", content: loaderData.entry.excerpt }]
              : []),
          ],
        }
      : {},
  component: Entry,
});

function Entry() {
  const { entry } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);
  const search = langSearch(lang);

  return (
    <article className="pb-8">
      <header className="border-b border-rule py-10 sm:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>{entry.publishedAt ? dateLong(entry.publishedAt, lang) : t.journal}</Eyebrow>
          {entry.tags.map((tag) => (
            <Badge key={tag} tone="muted">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="mt-6 max-w-4xl font-display text-[clamp(2.2rem,6.5vw,4.4rem)] font-medium leading-[0.96]">
          {entry.title}
        </h1>
        {entry.excerpt ? (
          <p className="mt-6 max-w-2xl font-display text-xl italic leading-relaxed text-dim">
            {entry.excerpt}
          </p>
        ) : null}
        {entry.author ? (
          <p className="mt-6 text-sm text-faint">
            {t.by}{" "}
            <Link
              to="/people/$slug"
              params={{ slug: entry.author.slug }}
              search={search}
              className="text-dim underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
            >
              {entry.author.name}
            </Link>
          </p>
        ) : null}
      </header>

      {entry.cover ? (
        <div className="mt-10">
          <Banner image={entry.cover} ratio="16 / 9" />
        </div>
      ) : null}

      <div className="grid gap-12 py-12 md:grid-cols-[2fr_1fr] md:gap-16">
        <RichText value={entry.body} />

        {entry.aboutFilm ? (
          <aside className="md:border-l md:border-rule md:pl-10">
            <Eyebrow className="mb-4">{t.films}</Eyebrow>
            <Link
              to="/films/$slug"
              params={{ slug: entry.aboutFilm.slug }}
              search={search}
              className="group block max-w-[14rem]"
            >
              <Poster
                title={entry.aboutFilm.title}
                year={entry.aboutFilm.year}
                image={entry.aboutFilm.poster}
                color={entry.aboutFilm.accentColor}
              />
              <p className="mt-3 font-display text-lg transition-colors group-hover:text-(--accent)">
                {entry.aboutFilm.title}
              </p>
            </Link>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
