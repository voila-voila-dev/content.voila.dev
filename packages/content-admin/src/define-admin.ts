// `defineAdmin` — the one call a site makes to configure the admin. It builds the
// CSRF-aware typed client, merges field-widget overrides, and bundles the
// extension config into an `AdminInstance` shared through `AdminProvider` to every
// screen. This is the client/config half; the server runtime
// (`@voila/content-admin/cloudflare`) is wired separately in `app/lib/server.ts`.

import type { NormalizedConfig } from "@voila/content";
import { makeClient, makeMediaClient } from "@voila/content/client";
import { createGeoInput, mergeDisplayRegistry, mergeEditRegistry } from "@voila/content-ui";
import { makeAuthedFetch } from "./lib/authed-fetch";
import type { AdminInstance, DefineAdminOptions } from "./types";

// Empty = mounted at the root. Each admin gets its own subdomain
// (admin.MYDOMAIN.TLD), so the admin IS the whole site: `/` is the dashboard,
// `/posts` a list, `/login` the sign-in. Set `basePath: "/admin"` to nest it
// under a path instead.
const DEFAULT_BASE_PATH = "";

// The public MapLibre demo style — a sensible default so map views render out of
// the box; production sites set their own `mapStyleUrl` (e.g. a MapTiler style).
const DEFAULT_MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";

/** Build the admin instance from a content config + optional extensions. */
export function defineAdmin<C extends NormalizedConfig>(
  options: DefineAdminOptions<C>,
): AdminInstance<C> {
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;
  const apiPath = options.apiPath ?? `${basePath}/api`;
  const loginPath = `${basePath}/login`;
  const mapStyleUrl = options.mapStyleUrl ?? DEFAULT_MAP_STYLE_URL;

  const fetch = options.fetch ?? makeAuthedFetch({ loginPath });
  const client = makeClient(options.config, { baseUrl: apiPath, fetch });
  const mediaClient = makeMediaClient({ baseUrl: apiPath, fetch });

  return {
    config: options.config,
    basePath,
    apiPath,
    branding: options.branding ?? {},
    client,
    mediaClient,
    // Upgrade the plain lat/lng geo input to a map picker bound to this admin's
    // `mapStyleUrl`, then layer the host's own widget overrides on top so they
    // still win (a host that sets `widgets.edit.geo` replaces the picker).
    editWidgets: mergeEditRegistry({
      geo: createGeoInput({ mapStyleUrl }),
      ...options.widgets?.edit,
    }),
    displayWidgets: mergeDisplayRegistry(options.widgets?.display),
    slots: options.slots ?? {},
    screens: options.screens ?? [],
    nav: options.nav,
    mapStyleUrl,
  };
}
