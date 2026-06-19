import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// The app router. TanStack Start looks for a `getRouter` export; the
// `Register` augmentation lives in the generated `routeTree.gen.ts` — run
// `vite dev` once and it appears.
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}
