// The typed REST client, inferred from `content.config.ts` — no codegen. Every
// collection method is typed from your fields:
//
//   const page = await client.posts.list({ orderBy: "createdAt" });
//   const post = await client.posts.create({ title: "Hi", slug: "hi" });
//
// The wrapped `fetch` does two things the secure admin needs: it mirrors the
// `voila_csrf` cookie into the `x-csrf-token` header on writes (the engine's
// double-submit check), and it bounces an expired/absent session (401) to the
// login page.

import { type Fetch, makeClient } from "@voila/content/client";
import config from "../../content.config";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie.match(/(?:^|;\s*)voila_csrf=([^;]+)/)?.[1];
}

const authedFetch: Fetch = async (input, init) => {
  const method = (init?.method ?? "GET").toUpperCase();
  let nextInit = init;
  if (MUTATING.has(method)) {
    const token = readCsrfToken();
    if (token) {
      const headers = new Headers(init?.headers);
      headers.set("x-csrf-token", token);
      nextInit = { ...init, headers };
    }
  }
  const response = await fetch(input, nextInit);
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/admin/login")
  ) {
    window.location.assign("/admin/login");
  }
  return response;
};

export const client = makeClient(config, { baseUrl: "/admin/api", fetch: authedFetch });
