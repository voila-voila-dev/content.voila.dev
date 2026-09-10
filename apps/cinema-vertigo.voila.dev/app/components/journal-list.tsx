// The journal index: a dated list, not a wall of cards. Title in the display
// face, byline and tags in the wide-tracked sans, one hairline between entries.

import { Link } from "@tanstack/react-router";
import { dateMedium } from "../lib/format";
import { type Lang, langSearch, strings } from "../lib/i18n";
import type { EntryCard } from "../lib/queries";
import { Badge } from "./primitives";

export function JournalRow({ entry, lang }: { entry: EntryCard; lang: Lang }) {
  const t = strings(lang);
  return (
    <li className="border-t border-rule py-7">
      <div className="grid gap-3 md:grid-cols-[9rem_1fr] md:gap-10">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-faint md:pt-2">
          {entry.publishedAt ? dateMedium(entry.publishedAt, lang) : ""}
        </p>
        <div>
          <h3 className="font-display text-[clamp(1.4rem,3vw,2rem)] leading-tight">
            <Link
              to="/journal/$slug"
              params={{ slug: entry.slug }}
              search={langSearch(lang)}
              className="transition-colors hover:text-(--accent)"
            >
              {entry.title}
            </Link>
          </h3>
          {entry.excerpt ? (
            <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-dim">
              {entry.excerpt}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {entry.author ? (
              <p className="text-sm text-faint">
                {t.by}{" "}
                <Link
                  to="/people/$slug"
                  params={{ slug: entry.author.slug }}
                  search={langSearch(lang)}
                  className="text-dim underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
                >
                  {entry.author.name}
                </Link>
              </p>
            ) : null}
            {entry.tags.map((tag) => (
              <Badge key={tag} tone="muted">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

export function JournalList({ entries, lang }: { entries: ReadonlyArray<EntryCard>; lang: Lang }) {
  return (
    <ul>
      {entries.map((entry) => (
        <JournalRow key={entry.id} entry={entry} lang={lang} />
      ))}
    </ul>
  );
}
