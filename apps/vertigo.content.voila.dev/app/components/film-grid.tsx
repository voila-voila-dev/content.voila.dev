// The catalogue grid. Each entry is a poster block and three lines of billing —
// no card chrome, no shadow; the grid gaps and the hairline under the title do
// the separating.

import { Link } from "@tanstack/react-router";
import { type Lang, langSearch, strings } from "../lib/i18n";
import type { FilmCard } from "../lib/queries";
import { MetaLine, Poster } from "./primitives";

export function FilmTile({ film, lang }: { film: FilmCard; lang: Lang }) {
  const t = strings(lang);
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.slug }}
        search={langSearch(lang)}
        className="group block"
      >
        <div className="transition-opacity group-hover:opacity-85">
          <Poster
            title={film.title}
            year={film.year}
            image={film.poster}
            color={film.accentColor}
          />
        </div>
        <h3 className="mt-4 font-display text-xl leading-tight transition-colors group-hover:text-(--accent)">
          {film.title}
        </h3>
        {film.originalTitle && film.originalTitle !== film.title ? (
          <p className="mt-0.5 font-display text-sm italic text-faint">{film.originalTitle}</p>
        ) : null}
        <MetaLine
          className="mt-2 text-[0.8rem]"
          items={[
            film.year ? String(film.year) : null,
            film.country,
            film.runtime ? `${film.runtime} ${t.minutes}` : null,
          ]}
        />
      </Link>
    </li>
  );
}

export function FilmGrid({ films, lang }: { films: ReadonlyArray<FilmCard>; lang: Lang }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {films.map((film) => (
        <FilmTile key={film.id} film={film} lang={lang} />
      ))}
    </ul>
  );
}
