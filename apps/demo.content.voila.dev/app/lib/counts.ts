// `fetchCounts` resolves the per-collection document count server-side so the
// dashboard renders real numbers in the SSR HTML — no client fetch waterfall.
// Content lives in the signed-in user's sandbox Durable Object, so the count is
// read from there (via the DO's internal `/__counts` route), not from D1.
// Wrapped in `createServerFn` so the server-only imports never reach the client.

import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { runtime } from "./server";

export const fetchCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    const principal = await runtime.auth.authenticator.authenticate(getRequest());
    if (!principal) return {};
    const stub = env.SANDBOX.get(env.SANDBOX.idFromName(principal.id));
    const response = await stub.fetch(
      new Request("https://sandbox/__counts", {
        headers: { "x-voila-principal": JSON.stringify(principal) },
      }),
    );
    if (!response.ok) return {};
    return (await response.json()) as Record<string, number>;
  },
);
