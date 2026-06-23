import { createRouter, Link } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// The app router. TanStack Start looks for a `getRouter` export; the
// `Register` augmentation lives in the generated `routeTree.gen.ts` — run
// `vite dev` once and it appears.
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
  });
}

// Rendered for any path the route tree doesn't match.
function NotFound() {
  return (
    <section className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That page doesn’t exist or may have moved.</p>
      <Link to="/" className="text-sm font-medium text-primary">
        Back to the dashboard
      </Link>
    </section>
  );
}
