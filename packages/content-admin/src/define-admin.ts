// `defineAdmin` — the one call a site makes to configure the admin. It builds the
// CSRF-aware typed client, merges field-widget overrides, and bundles the
// extension config into an `AdminInstance` shared through `AdminProvider` to every
// screen. This is the client/config half; the server runtime
// (`@voila/content-admin/cloudflare`) is wired separately in `app/lib/server.ts`.

import type { NormalizedConfig } from "@voila/content";
import { makeClient, makeMediaClient } from "@voila/content/client";
import {
  createGeoInput,
  createRelationDisplay,
  createRelationInput,
  DEFAULT_MAP_DARK_STYLE_URL,
  DEFAULT_MAP_STYLE_URL,
  mergeDisplayRegistry,
  mergeEditRegistry,
  resolveMessages,
} from "@voila/content-ui";
import { makeAuthedFetch } from "./lib/authed-fetch";
import { makeRelationLoader } from "./lib/relation-source";
import type { AdminInstance, DefineAdminOptions, ResolvedAdminTheme } from "./types";

// Empty = mounted at the root. Each admin gets its own subdomain
// (admin.MYDOMAIN.TLD), so the admin IS the whole site: `/` is the dashboard,
// `/posts` a list, `/login` the sign-in. Set `basePath: "/admin"` to nest it
// under a path instead.
const DEFAULT_BASE_PATH = "";

/** Normalize the theme onto the instance. Nothing is defaulted in: an unset
 *  radius or density emits no CSS declaration, which is what keeps a project
 *  that configures nothing rendering exactly as it does today. */
function resolveTheme(theme: DefineAdminOptions["theme"]): ResolvedAdminTheme {
  const resolved: {
    accent?: string;
    accentFrom?: string;
    logoFrom?: string;
    radius?: ResolvedAdminTheme["radius"];
    density?: ResolvedAdminTheme["density"];
  } = {};
  if (theme?.accent !== undefined) resolved.accent = theme.accent;
  if (theme?.accentFrom !== undefined) resolved.accentFrom = theme.accentFrom;
  if (theme?.logoFrom !== undefined) resolved.logoFrom = theme.logoFrom;
  if (theme?.radius !== undefined) resolved.radius = theme.radius;
  if (theme?.density !== undefined) resolved.density = theme.density;
  return resolved;
}

/** Build the admin instance from a content config + optional extensions. */
export function defineAdmin<C extends NormalizedConfig>(
  options: DefineAdminOptions<C>,
): AdminInstance<C> {
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;
  const apiPath = options.apiPath ?? `${basePath}/api`;
  const loginPath = `${basePath}/login`;
  // Basemap styles resolve from `defineAdmin` options first, then the content
  // config's `map`, then the free OpenFreeMap defaults — so maps render out of
  // the box with no API key. A custom light style without a dark counterpart opts
  // out of theme-swapping; the OpenFreeMap default keeps its dark variant so the
  // map follows the admin theme by default.
  const customStyleUrl = options.mapStyleUrl ?? options.config.map?.styleUrl;
  const customDarkStyleUrl = options.mapDarkStyleUrl ?? options.config.map?.darkStyleUrl;
  const mapStyleUrl = customStyleUrl ?? DEFAULT_MAP_STYLE_URL;
  const mapDarkStyleUrl =
    customDarkStyleUrl ?? (customStyleUrl === undefined ? DEFAULT_MAP_DARK_STYLE_URL : undefined);

  const fetch = options.fetch ?? makeAuthedFetch({ loginPath });
  const client = makeClient(options.config, { baseUrl: apiPath, fetch });
  const mediaClient = makeMediaClient({ baseUrl: apiPath, fetch });
  // One memoised loader shared by the relation editor and the relation reader,
  // so a table of rows resolving the same target hits the API once.
  const loadRelations = makeRelationLoader(options.config, client);

  return {
    config: options.config,
    basePath,
    apiPath,
    branding: options.branding ?? {},
    theme: resolveTheme(options.theme),
    client,
    mediaClient,
    // Upgrade the plain lat/lng geo input to a map picker bound to this admin's
    // `mapStyleUrl`, then layer the host's own widget overrides on top so they
    // still win (a host that sets `widgets.edit.geo` replaces the picker).
    editWidgets: mergeEditRegistry({
      geo: createGeoInput({ mapStyleUrl, darkStyleUrl: mapDarkStyleUrl }),
      // Upgrade the id fallback to a real searchable picker over the target
      // collection — the admin is the layer that knows how to fetch.
      relation: createRelationInput({ load: loadRelations }),
      ...options.widgets?.edit,
    }),
    displayWidgets: mergeDisplayRegistry({
      relation: createRelationDisplay({ load: loadRelations }),
      ...options.widgets?.display,
    }),
    slots: options.slots ?? {},
    screens: options.screens ?? [],
    nav: options.nav,
    mapStyleUrl,
    mapDarkStyleUrl,
    counts: options.counts,
    locale: options.locale,
    messages: resolveMessages(options.locale, options.messages),
    preview: options.preview ?? {},
  };
}
