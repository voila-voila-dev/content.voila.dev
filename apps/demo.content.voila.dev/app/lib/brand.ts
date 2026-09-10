// `fetchBrand` resolves the theme the editors own — the `settings` singleton's
// `primaryColor` and `logo` — server-side, so the accent tokens are already in
// the `<head>` of the first byte of HTML. Doing this in a client effect would
// paint the default admin and then repaint it in the brand on every load.
//
// Content lives in the signed-in user's sandbox Durable Object, so the singleton
// is read through the DO's own REST handler (the same route the admin's client
// uses), not from D1 — the same shape as `fetchCounts`. A signed-out visitor or
// a failed read yields no brand: the login page then renders the stock theme
// rather than 500ing.

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type AdminBrandSource, readBrandSource } from "@voila/content-admin";
import { admin } from "./admin";
import { runtime } from "./server";

export const fetchBrand = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminBrandSource> => {
    const principal = await runtime.auth.authenticator.authenticate(getRequest());
    if (!principal) return {};
    const stub = env.SANDBOX.get(env.SANDBOX.idFromName(principal.id));
    const response = await stub.fetch(
      new Request("https://sandbox/api/settings", {
        headers: { "x-voila-principal": JSON.stringify(principal) },
      }),
    );
    // 404 until the singleton has been written once — a fresh sandbox is seeded,
    // but a wiped one between requests must still render.
    if (!response.ok) return {};
    const body = (await response.json()) as { data?: unknown };
    return readBrandSource(admin.theme, { settings: body.data ?? null });
  },
);
