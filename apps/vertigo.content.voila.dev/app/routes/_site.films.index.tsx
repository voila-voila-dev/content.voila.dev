// The catalogue.

import { createFileRoute } from "@tanstack/react-router";
import { FilmGrid } from "../components/film-grid";
import { Empty, PageHeader } from "../components/primitives";
import { type Lang, strings } from "../lib/i18n";
import { fetchFilms } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/_site/films/")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchFilms({ data: { lang: deps.lang } }),
  component: Films,
});

function Films() {
  const { films } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);

  return (
    <div className="pb-8">
      <PageHeader eyebrow={`${films.length} ${t.films}`} title={t.films} />
      <div className="mt-12">
        {films.length === 0 ? <Empty>{t.noFilms}</Empty> : <FilmGrid films={films} lang={lang} />}
      </div>
    </div>
  );
}
