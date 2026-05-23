import type { ResolvedContentConfig } from "./types.ts";

/**
 * Structurally compatible with TanStack Router's `RouteOptions.head`
 * return shape. Loose by design so this package doesn't have to pin a
 * `@tanstack/react-router` type version; the plugin spreads it straight
 * into the virtual route definition.
 */
export type RouteHead = {
  meta?: Array<{ title?: string; name?: string; content?: string }>;
  links?: Array<{ rel: string; href: string }>;
  styles?: Array<{ children: string }>;
};

export function buildAdminHead(config: ResolvedContentConfig): RouteHead {
  const name = config.branding.name ?? "Voila";
  const { favicon, accent } = config.branding;

  const meta: NonNullable<RouteHead["meta"]> = [
    { title: name },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "voila:mount-admin", content: config.mount.admin },
    { name: "voila:mount-api", content: config.mount.api },
  ];

  const head: RouteHead = { meta };
  if (favicon) head.links = [{ rel: "icon", href: favicon }];
  if (accent) head.styles = [{ children: `:root { --voila-color-accent: ${accent}; }` }];
  return head;
}

export function buildSetupHead(config: ResolvedContentConfig): RouteHead {
  const name = config.branding.name ?? "Voila";
  return {
    meta: [
      { title: `Setup — ${name}` },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  };
}
