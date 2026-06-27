// The public extension surface for `defineAdmin` — how a site customizes the
// admin "from config, no eject": custom screens, nav, slots, and field widgets.
// All optional; an admin with none is the plain config-driven CRUD.

import type { Collection, NormalizedConfig } from "@voila/content";
import type { ContentClient, Fetch, MediaClient } from "@voila/content/client";
import type { DisplayRegistry, EditRegistry, NavItem } from "@voila/content-ui";
import type { ComponentType, ReactNode } from "react";

/** The signed-in user as the admin chrome needs it. */
export interface AdminUser {
  readonly id: string;
  readonly email: string | null;
}

/** Branding shown in the shell header, login page, and document title. */
export interface AdminBranding {
  /** Heading shown in the shell header bar and used as the document `<title>`. */
  readonly title?: string;
  /**
   * Logo shown in the sidebar header, beside the config's `branding.name`. A
   * string is treated as an image `src` — an SVG or PNG URL or data URI,
   * rendered as an `<img>`; pass a `ReactNode` for full control (e.g. an inline
   * SVG component).
   */
  readonly logo?: ReactNode | string;
  /**
   * Favicon `href` — an SVG, PNG, or ICO URL or data URI. Wire it into the
   * document `<head>` with {@link import("./lib/branding-head").brandingHead}.
   */
  readonly favicon?: string;
}

/** Props a custom screen's component receives. `data` is its loader's result. */
export interface CustomScreenProps<C extends NormalizedConfig = NormalizedConfig> {
  readonly client: ContentClient<C>;
  readonly params: Readonly<Record<string, string>>;
  readonly data: unknown;
  readonly config: C;
}

/**
 * A custom admin screen registered in config — the file-free way to "add a
 * screen/route". Mounted by the catch-all dispatcher under the admin guard +
 * shell. `path` is relative to the admin base (e.g. `/analytics`,
 * `/posts/:id/preview`).
 */
export interface CustomScreen<C extends NormalizedConfig = NormalizedConfig> {
  readonly id: string;
  readonly path: string;
  readonly component: ComponentType<CustomScreenProps<C>>;
  /** Optional data loader; runs before render with the authed typed client. */
  readonly loader?: (ctx: {
    readonly client: ContentClient<C>;
    readonly params: Readonly<Record<string, string>>;
  }) => unknown | Promise<unknown>;
  /** Nav placement; omit to keep the screen routable but hidden from the menu. */
  readonly nav?: {
    readonly label: string;
    readonly group?: string;
    readonly order?: number;
  };
}

/** Nav customization layered over the config-derived collections/singletons.
 *  Custom screens with a `nav` entry are added automatically; `extra` adds
 *  arbitrary links (e.g. to the public site) under their `group` label. */
export interface NavExtension {
  /** Extra standalone items appended after the config + custom-screen nav. */
  readonly extra?: readonly (NavItem & { readonly group?: string })[];
}

/** Slot overrides — config-to-prop adapters over the `@voila/content-ui` blocks. */
export interface AdminSlots<C extends NormalizedConfig = NormalizedConfig> {
  readonly shell?: {
    readonly sidebarHeader?: ReactNode;
    readonly sidebarFooter?: (ctx: { user?: AdminUser }) => ReactNode;
    readonly headerActions?: ReactNode;
  };
  readonly dashboard?: {
    readonly header?: ReactNode;
    readonly cards?: (ctx: { config: C; counts: Readonly<Record<string, number>> }) => ReactNode;
  };
  readonly collection?: {
    readonly listActions?: (ctx: { slug: string; client: ContentClient<C> }) => ReactNode;
    readonly detailActions?: (ctx: {
      slug: string;
      id: string;
      client: ContentClient<C>;
    }) => ReactNode;
    readonly emptyState?: (ctx: { slug: string; collection: Collection }) => ReactNode;
  };
}

/** Options for {@link import("./define-admin").defineAdmin}. */
export interface DefineAdminOptions<C extends NormalizedConfig = NormalizedConfig> {
  readonly config: C;
  /** URL prefix the admin mounts under. Default `/admin`. */
  readonly basePath?: string;
  /** Where the REST + auth routes live. Default `${basePath}/api`. */
  readonly apiPath?: string;
  readonly branding?: AdminBranding;
  /** Field widget overrides, merged over the content-ui defaults. */
  readonly widgets?: { readonly edit?: EditRegistry; readonly display?: DisplayRegistry };
  readonly slots?: AdminSlots<C>;
  readonly screens?: readonly CustomScreen<C>[];
  readonly nav?: NavExtension;
  /** Override the CSRF-aware fetch (tests / custom transport). */
  readonly fetch?: Fetch;
  /** maplibre-gl style URL used by map views. Defaults to the free OpenFreeMap
   *  "liberty" basemap (or the project's `config.map.styleUrl`); set your own
   *  (e.g. a MapTiler style) for richer cartography. */
  readonly mapStyleUrl?: string;
  /** Dark-theme basemap; when set (here or via `config.map.darkStyleUrl`), map
   *  surfaces follow the admin's light/dark theme. */
  readonly mapDarkStyleUrl?: string;
}

/** The built admin instance shared through context to every screen. */
export interface AdminInstance<C extends NormalizedConfig = NormalizedConfig> {
  readonly config: C;
  readonly basePath: string;
  readonly apiPath: string;
  readonly branding: AdminBranding;
  readonly client: ContentClient<C>;
  readonly mediaClient: MediaClient;
  readonly editWidgets: EditRegistry;
  readonly displayWidgets: DisplayRegistry;
  readonly slots: AdminSlots<C>;
  readonly screens: readonly CustomScreen<C>[];
  readonly nav?: NavExtension;
  /** maplibre-gl style URL for map views. */
  readonly mapStyleUrl: string;
  /** Dark-theme basemap; when set, map surfaces follow the admin theme. */
  readonly mapDarkStyleUrl?: string;
}
