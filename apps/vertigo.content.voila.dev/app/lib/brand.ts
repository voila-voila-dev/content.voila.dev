// `fetchBrand` resolves the theme the editors own — the `settings` singleton's
// `primaryColor` and `logo` — server-side, so the accent tokens are already in
// the `<head>` of the first byte of admin HTML. Doing this in a client effect
// would paint the default admin and then repaint it in the cinema's colour on
// every load.
//
// It reads the same D1 the public site reads (via `runtime.database`), so the
// colour an editor picks in Settings is the admin's accent AND the public site's
// `--accent` from the same row. A failed read yields no brand rather than a 500:
// a missing settings row must not take the admin down.

import { createServerFn } from "@tanstack/react-start";
import type { AdminBrandSource } from "@voila/content-admin";
import { resolveBrandSource } from "@voila/content-admin/server";
import { admin } from "./admin";
import { runtime } from "./server";

export const fetchBrand = createServerFn({ method: "GET" }).handler(
  (): Promise<AdminBrandSource> => resolveBrandSource(admin.theme, runtime.database),
);
