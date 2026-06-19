// AppSidebar — the admin navigation, built entirely from a `@voila/content`
// config. Collections and singletons each get a menu group; the active item is
// derived from `currentPath`. Links are router-agnostic: by default each entry
// is a plain `<a href>`, but pass `renderLink` to swap in a framework `Link`
// (TanStack/Next) — it receives the `NavItem` and returns the anchor element
// the menu button renders through. Must be used inside a `Sidebar.Provider`
// (`AdminShell` supplies one).

import type { NormalizedConfig } from "@voila/content";
import { Sidebar } from "@voila/ui";
import type { ReactElement, ReactNode } from "react";
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
  /** Content for the sidebar footer (e.g. a user menu / sign-out). */
  readonly footer?: ReactNode;
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
  footer,
}: AppSidebarProps): ReactNode {
  const nav = buildNav(config, { basePath, currentPath });

  return (
    <Sidebar.Root>
      <Sidebar.Header>
        <div className="px-2 py-1 font-semibold text-sidebar-foreground">
          {config.branding.name}
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        <NavGroup label="Collections" items={nav.collections} renderLink={renderLink} />
        <NavGroup label="Content" items={nav.singletons} renderLink={renderLink} />
      </Sidebar.Content>
      {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
    </Sidebar.Root>
  );
}
