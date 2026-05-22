import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "./admin-shell.tsx";
import { SetupPage } from "./setup-page.tsx";
import type { Content } from "./types.ts";

const DOCTYPE = "<!doctype html>";

export type HealthBody = {
  ok: true;
  name: "@voila/content";
  version: string;
  time: string;
};

export const PACKAGE_VERSION = "0.1.0";

export function renderAdminShell(content: Content): string {
  return `${DOCTYPE}${renderToStaticMarkup(<AdminShell config={content} />)}`;
}

export function renderSetup(content: Content): string {
  return `${DOCTYPE}${renderToStaticMarkup(<SetupPage config={content} />)}`;
}

export function buildHealthBody(): HealthBody {
  return {
    ok: true,
    name: "@voila/content",
    version: PACKAGE_VERSION,
    time: new Date().toISOString(),
  };
}
