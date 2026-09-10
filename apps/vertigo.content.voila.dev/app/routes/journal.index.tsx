// The writing: programme notes, interviews, restoration diaries.

import { createFileRoute } from "@tanstack/react-router";
import { JournalList } from "../components/journal-list";
import { Empty, PageHeader } from "../components/primitives";
import { type Lang, strings } from "../lib/i18n";
import { fetchJournal } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/journal/")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchJournal({ data: { lang: deps.lang } }),
  component: Journal,
});

function Journal() {
  const { entries } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);

  return (
    <div className="pb-8">
      <PageHeader eyebrow={t.journal} title={t.journal} />
      <div className="mt-12">
        {entries.length === 0 ? (
          <Empty>{t.noEntries}</Empty>
        ) : (
          <JournalList entries={entries} lang={lang} />
        )}
      </div>
    </div>
  );
}
