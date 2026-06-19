// Derive a document's publish state from its `status` + `publishedAt` system
// columns (present only on draft-enabled collections). A row whose `status` is
// `published` but whose `publishedAt` is still in the future is *scheduled*, not
// yet live — the same distinction `Database.list` makes. Returns `null` when the
// row has no `status` at all (a non-draft collection), so callers render nothing.

import type { Doc } from "./doc";

export type PublishState = "draft" | "published" | "scheduled";

export function publishStatus(doc: Doc, now: number = Date.now()): PublishState | null {
  const status = doc.status;
  if (status !== "draft" && status !== "published") return null;
  if (status === "draft") return "draft";
  const at = doc.publishedAt;
  return typeof at === "number" && at > now ? "scheduled" : "published";
}
