// The default fields a board / map / calendar card shows under its title when a
// view doesn't pick its own: a few SHORT fields (a status, a category, a date —
// never a rich-text body), excluding the title (already the heading) and the
// field the view is organised by (the kanban column, the plotted point, the
// event's dates). Shared by the views and the list screen so the fields a card
// renders are the fields the list query actually fetches.

import type { Collection } from "@voila/content";

const SHORT_KINDS: ReadonlySet<string> = new Set([
  "string",
  "slug",
  "enum",
  "select",
  "boolean",
  "number",
  "date",
  "datetime",
  "time",
  "color",
  "duration",
  "position",
]);

export function defaultCardFields(
  collection: Collection,
  exclude: ReadonlyArray<string | undefined> = [],
  max = 3,
): string[] {
  const skip = new Set<string>([
    collection.titleField ?? "",
    ...(exclude.filter(Boolean) as string[]),
  ]);
  const keys = Object.keys(collection.fields).filter((key) => {
    const field = collection.fields[key];
    return field !== undefined && !field.meta.hidden && !skip.has(key);
  });
  const short = keys.filter((key) => SHORT_KINDS.has(collection.fields[key]?.meta.kind ?? ""));
  return (short.length > 0 ? short : keys).slice(0, max);
}
