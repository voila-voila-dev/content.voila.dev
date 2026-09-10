import { createFileRoute, notFound } from "@tanstack/react-router";

// The catch-all for URLs nothing else matches. It lives under `_site` on
// purpose: an unmatched path is a visitor's typo, so it should land in the
// public shell (header, footer, the site's stylesheet) rather than on the bare
// document, and `_site`'s own `notFoundComponent` renders it. `/admin/...` is
// unaffected — its static segment outranks this splat.
//
// Throwing from the loader rather than rendering the 404 directly is what makes
// the response carry a real 404 status instead of 200 with apologetic copy.
export const Route = createFileRoute("/_site/$")({
  loader: () => {
    throw notFound();
  },
});
