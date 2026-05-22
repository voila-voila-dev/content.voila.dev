import type { ResolvedContentConfig } from "./types.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

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
  const name = config.branding.name ?? "Voila";
  const favicon = config.branding.favicon;
  const accent = config.branding.accent;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(name)}</title>
${favicon ? `    <link rel="icon" href="${escapeAttr(favicon)}" />\n` : ""}    <meta name="voila:mount-admin" content="${escapeAttr(config.mount.admin)}" />
    <meta name="voila:mount-api" content="${escapeAttr(config.mount.api)}" />
${accent ? `    <style>:root { --voila-color-accent: ${escapeAttr(accent)}; }</style>\n` : ""}  </head>
  <body>
    <div
      id="voila-admin"
      data-mount-admin="${escapeAttr(config.mount.admin)}"
      data-mount-api="${escapeAttr(config.mount.api)}"
      data-brand-name="${escapeAttr(name)}"
    ></div>
  </body>
</html>
`;
}

export function renderSetup(config: ResolvedContentConfig): string {
  const name = config.branding.name ?? "Voila";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Setup — ${escapeHtml(name)}</title>
  </head>
  <body>
    <main id="voila-setup" data-brand-name="${escapeAttr(name)}">
      <h1>Welcome to ${escapeHtml(name)}</h1>
      <p>First-run setup is not implemented yet.</p>
    </main>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
