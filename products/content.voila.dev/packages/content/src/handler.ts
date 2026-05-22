import {
  adminShellResponse,
  healthResponse,
  notFoundJsonResponse,
  notFoundResponse,
  setupResponse,
} from "./responses.ts";
import type { ResolvedContentConfig } from "./types.ts";

export async function handle(request: Request, config: ResolvedContentConfig): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const { mount } = config;

  if (pathname === `${mount.api}/health`) {
    return healthResponse();
  }

  if (isUnder(pathname, mount.api)) {
    return notFoundJsonResponse();
  }

  if (pathname === `${mount.admin}/setup`) {
    return setupResponse(config);
  }

  if (isUnder(pathname, mount.admin)) {
    return adminShellResponse(config);
  }

  return notFoundResponse();
}

function isUnder(pathname: string, mount: string): boolean {
  return pathname === mount || pathname.startsWith(`${mount}/`);
}
