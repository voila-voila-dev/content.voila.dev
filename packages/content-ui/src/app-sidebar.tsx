// AppSidebar — the admin navigation, built entirely from a `@voila/content`
// config. Collections and singletons each get a menu group; the active item is
// derived from `currentPath`. Links are router-agnostic: by default each entry
// is a plain `<a href>`, but pass `renderLink` to swap in a framework `Link`
// (TanStack/Next) — it receives the `NavItem` and returns the anchor element
// the menu button renders through. Must be used inside a `Sidebar.Provider`
// (`AdminShell` supplies one).

import type { NormalizedConfig } from "@voila/content";
import { Sidebar } from "@voila/ui/sidebar";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { buildNav, type NavItem } from "./lib/nav";

export interface AppSidebarProps {
  readonly config: NormalizedConfig;
  /** Current pathname, used to highlight the active nav item. */
  readonly currentPath?: string;
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /**
   * Render the anchor element for a nav item. Defaults to a plain `<a href>`.
   * Return an element that accepts injected `className`/`children` (the sidebar
   * styles and labels it), e.g. `(item) => <Link to={item.href} />`.
   */
  readonly renderLink?: (item: NavItem) => ReactElement;
  /**
   * Logo shown in the sidebar header beside the config's `branding.name` — an
   * already-rendered node (an `<img>`, an inline SVG, etc.). Omit for the
   * name-only header.
   */
  readonly logo?: ReactNode;
  /** Content for the sidebar footer (e.g. a user menu / sign-out). */
  readonly footer?: ReactNode;
  /**
   * Extra nav groups appended after the config-derived collections/singletons —
   * e.g. custom admin screens. Each renders as its own labelled menu group; an
   * empty `items` array is skipped. Optional and additive: omitting it leaves
   * the config-only nav unchanged.
   */
  readonly extraGroups?: ReadonlyArray<{
    readonly label: string;
    readonly items: readonly NavItem[];
  }>;
}

function defaultRenderLink(item: NavItem): ReactElement {
  // biome-ignore lint/a11y/useAnchorContent: the sidebar injects the label as children
  return <a href={item.href} />;
}

function NavGroup({
  label,
  items,
  renderLink,
}: {
  readonly label: string;
  readonly items: readonly NavItem[];
  readonly renderLink: (item: NavItem) => ReactElement;
}): ReactNode {
  if (items.length === 0) return null;
  return (
    <Sidebar.Group.Root>
      <Sidebar.Group.Label>{label}</Sidebar.Group.Label>
      <Sidebar.Group.Content>
        <Sidebar.Menu.Root>
          {items.map((item) => (
            <Sidebar.Menu.Item key={item.slug}>
              <Sidebar.Menu.Button
                isActive={item.isActive}
                tooltip={item.label}
                // Cast mirrors @voila/ui's own `render` plumbing: a concrete
                // anchor element's props aren't a `Record<string, unknown>`.
                render={renderLink(item) as ReactElement<Record<string, unknown>>}
              >
                <span>{item.label}</span>
              </Sidebar.Menu.Button>
            </Sidebar.Menu.Item>
          ))}
        </Sidebar.Menu.Root>
      </Sidebar.Group.Content>
    </Sidebar.Group.Root>
  );
}

export function AppSidebar({
  config,
  currentPath,
  basePath,
  renderLink = defaultRenderLink,
  logo,
  footer,
  extraGroups,
}: AppSidebarProps): ReactNode {
  const nav = buildNav(config, { basePath, currentPath });

  // The brand header links home (the dashboard). `basePath` is where the admin
  // mounts, so the dashboard lives there — except a root-mounted admin
  // (`basePath: ""`) whose dashboard is `/`. Routed through the same
  // `renderLink` as the nav so it uses the host's framework `Link`.
  const base = basePath ?? "/admin";
  const homeHref = base === "" ? "/" : base;
  const homeLink = cloneElement(
    renderLink({
      slug: "__home",
      label: config.branding.name,
      href: homeHref,
      isActive: false,
      kind: "collection",
    }) as ReactElement<Record<string, unknown>>,
    {
      className:
        "flex items-center gap-2 rounded-md px-2 py-1 font-semibold text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
      "aria-label": `${config.branding.name} — dashboard`,
    },
    logo ? <span className="flex shrink-0 items-center">{logo}</span> : null,
    <span className="truncate">{config.branding.name}</span>,
  );

  return (
    // `inset` floats the content area as a rounded, bordered panel (see
    // `AdminShell`); the sidebar sits on the tinted `bg-sidebar` gutter.
    <Sidebar.Root variant="inset">
      <Sidebar.Header>{homeLink}</Sidebar.Header>
      <Sidebar.Content>
        <NavGroup label="Collections" items={nav.collections} renderLink={renderLink} />
        <NavGroup label="Content" items={nav.singletons} renderLink={renderLink} />
        {extraGroups?.map((group) => (
          <NavGroup
            key={group.label}
            label={group.label}
            items={group.items}
            renderLink={renderLink}
          />
        ))}
      </Sidebar.Content>
      {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
    </Sidebar.Root>
  );
}
