// resolveBackTo — where a screen's back link goes, from the nav model: an entity
// (detail / new) returns to its list; a list returns home. One place so every
// header agrees (the sidebar's section back row uses the same target).

import { homeHref } from "@voila/content-ui";

export interface BackTarget {
  readonly href: string;
  readonly label: string;
}

/** The list page of a collection/singleton under the admin base. */
export function listHref(basePath: string, slug: string): string {
  return `${basePath}/${slug}`;
}

/** Back from an entity page (detail / new / edit) → its list. */
export function backToList(basePath: string, slug: string, label: string): BackTarget {
  return { href: listHref(basePath, slug), label: `Back to ${label}` };
}

/** Back from a list page → the dashboard. */
export function backToHome(basePath: string): BackTarget {
  return { href: homeHref(basePath), label: "Back to overview" };
}
