// RecordPager — move to the previous / next record without going back to the
// list.
//
// Reviewing a collection means opening a record, reading it, going back, and
// opening the next one. That round trip is the single most repeated motion in
// any CMS, and the admin had no way to skip it. This pages through the
// collection in the list's own order, and binds J / K so a keyboard user never
// touches the mouse.
//
// The sibling order comes from one cached page of the collection, not a
// bespoke endpoint: it is the same query the list screen already warms, so
// arriving from a list costs no extra request. A record outside that page
// (deep in a long collection) simply gets no arrows rather than a wrong one.

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMessages } from "@voila/content-ui";
import { Button } from "@voila.dev/ui/button";
import { type ReactNode, useEffect } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { type AnyListParams, collectionClient } from "../lib/client-access";

/** How many siblings are held for paging. */
const SIBLING_PAGE = 100;

export interface RecordPagerProps {
  readonly slug: string;
  readonly id: string;
  /** Suppress the keyboard bindings (e.g. while a form is open). */
  readonly keyboard?: boolean;
}

/** The ids either side of `id`, or undefined at the ends / off the page. */
export function siblingIds(
  ids: ReadonlyArray<string>,
  id: string,
): { readonly previous?: string; readonly next?: string } {
  const index = ids.indexOf(id);
  if (index === -1) return {};
  return {
    ...(index > 0 ? { previous: ids[index - 1] } : {}),
    ...(index < ids.length - 1 ? { next: ids[index + 1] } : {}),
  };
}

export function RecordPager({ slug, id, keyboard = true }: RecordPagerProps): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const m = useMessages().admin;
  const api = collectionClient(admin.client, slug);

  const siblings = useQuery({
    queryKey: [slug, "siblings"],
    queryFn: () =>
      api.list({ limit: SIBLING_PAGE, orderBy: "updatedAt", order: "desc" } as AnyListParams),
    staleTime: 30_000,
  });

  const ids = (siblings.data?.data ?? []).map((row) => String(row.id));
  const { previous, next } = siblingIds(ids, id);
  const href = (target: string) => `${admin.basePath}/${slug}/${target}`;

  // J / K, the convention every list-shaped tool shares. Ignored while the user
  // is typing, so pressing "j" in a title field doesn't navigate away.
  useEffect(() => {
    if (!keyboard) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "j" && next !== undefined) void navigate({ href: href(next) });
      if (event.key === "k" && previous !== undefined) void navigate({ href: href(previous) });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboard, next, previous, navigate, slug, admin.basePath]);

  // Nothing to page through — one record, or this one isn't on the loaded page.
  if (previous === undefined && next === undefined) return null;

  return (
    // Hidden on a phone: the header has no room for it beside the title and
    // actions, and the list is one tap away.
    <div data-slot="record-pager" className="hidden items-center sm:flex">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.previousRecord}
        title={m.previousRecord}
        disabled={previous === undefined}
        nativeButton={previous !== undefined ? false : undefined}
        render={previous !== undefined ? <AdminLink href={href(previous)} /> : undefined}
      >
        <CaretLeftIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.nextRecord}
        title={m.nextRecord}
        disabled={next === undefined}
        nativeButton={next !== undefined ? false : undefined}
        render={next !== undefined ? <AdminLink href={href(next)} /> : undefined}
      >
        <CaretRightIcon aria-hidden />
      </Button>
    </div>
  );
}
