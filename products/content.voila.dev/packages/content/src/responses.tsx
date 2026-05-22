import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "./admin-shell.tsx";
import { SetupPage } from "./setup-page.tsx";
import type { ResolvedContentConfig } from "./types.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;
const DOCTYPE = "<!doctype html>";

export type HealthBody = {
  ok: true;
  name: "@voila/content";
  version: string;
  time: string;
};

export const PACKAGE_VERSION = "0.1.0";

export function healthResponse(): Response {
  const body: HealthBody = {
    ok: true,
    name: "@voila/content",
    version: PACKAGE_VERSION,
    time: new Date().toISOString(),
  };
  return Response.json(body);
}

export function adminShellResponse(config: ResolvedContentConfig): Response {
  return new Response(renderAdminShell(config), { status: 200, headers: HTML_HEADERS });
}

export function setupResponse(config: ResolvedContentConfig): Response {
  return new Response(renderSetup(config), { status: 200, headers: HTML_HEADERS });
}

export function notFoundJsonResponse(): Response {
  return Response.json(
    { error: { code: "not_found", message: "Route not found." } },
    { status: 404 },
  );
}

export function notFoundResponse(): Response {
  return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } });
}

export function renderAdminShell(config: ResolvedContentConfig): string {
  return `${DOCTYPE}${renderToStaticMarkup(<AdminShell config={config} />)}`;
}

export function renderSetup(config: ResolvedContentConfig): string {
  return `${DOCTYPE}${renderToStaticMarkup(<SetupPage config={config} />)}`;
}
