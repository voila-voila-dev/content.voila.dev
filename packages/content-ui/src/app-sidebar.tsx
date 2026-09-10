// AppSidebar — the admin navigation, built entirely from a `@voila/content`
// config. ONE nav surface at a time: the top level is a tree (home, then each
// collection/singleton group — icon · label · count badge), and while an entity
// page is mounted the whole content swaps to that entity's `section` (a back
// row, the document's title, one item per field group). Above the tree sit the
// brand block (32px tinted badge + name + subtitle, links home) and a search
// entry (⌘K). Links are router-agnostic: by default each entry is a plain
// `<a href>`, but pass `renderLink` to swap in a framework `Link` — it receives
// the `NavItem` and returns the anchor the menu button renders through. Must be
// used inside a `Sidebar.Provider` (`AdminShell` supplies one). Collapsed, it's
// an icon rail with tooltips.

import { CaretLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { NormalizedConfig } from "@voila/content";
import { Kbd } from "@voila.dev/ui/kbd";
import { Sidebar } from "@voila.dev/ui/sidebar";
import { cn } from "@voila.dev/ui/utils";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { NamedIcon } from "./lib/icons";
import { buildNav, DEFAULT_NAV_ICONS, homeHref, type NavItem } from "./lib/nav";
import type { SidebarSection } from "./lib/shell-context";

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
  /** Logo shown in the brand block — an already-rendered node. Omit for an initial. */
  readonly logo?: ReactNode;
  /** Muted line under the brand name. */
  readonly brandSubtitle?: ReactNode;
  /** Content for the sidebar footer (e.g. `UserMenu`). */
  readonly footer?: ReactNode;
  /**
   * Extra nav groups appended after the config-derived collections/singletons —
   * e.g. custom admin screens. Each renders as its own labelled menu group; an
   * empty `items` array is skipped. Optional and additive.
   */
  readonly extraGroups?: ReadonlyArray<{
    readonly label: string;
    readonly items: readonly NavItem[];
  }>;
  /** Document count per collection slug, shown as a trailing badge. */
  readonly counts?: Readonly<Record<string, number>>;
  /** When set, the content swaps to this entity section (see `ShellContext`). */
  readonly section?: SidebarSection | null;
  /** Called when the search entry is activated; omit to hide it. */
  readonly onSearch?: () => void;
  /** Label of the home item. Defaults to "Overview". */
  readonly homeLabel?: string;
}

function defaultRenderLink(item: NavItem): ReactElement {
  // biome-ignore lint/a11y/useAnchorContent: the sidebar injects the label as children
  return <a href={item.href} />;
}

type LinkElement = ReactElement<Record<string, unknown>>;

function NavGroup({
  label,
  items,
  renderLink,
  counts,
}: {
  readonly label?: string;
  readonly items: readonly NavItem[];
  readonly renderLink: (item: NavItem) => ReactElement;
  readonly counts?: Readonly<Record<string, number>>;
}): ReactNode {
  if (items.length === 0) return null;
  return (
    <Sidebar.Group>
      {label ? <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel> : null}
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {items.map((item) => {
            const count = counts?.[item.slug];
            return (
              <Sidebar.MenuItem key={item.slug}>
                <Sidebar.MenuButton
                  isActive={item.isActive}
                  tooltip={item.label}
                  // Cast mirrors @voila.dev/ui's own `render` plumbing: a concrete
                  // anchor element's props aren't a `Record<string, unknown>`.
                  render={renderLink(item) as LinkElement}
                >
                  <NamedIcon name={item.icon} fallback={DEFAULT_NAV_ICONS[item.kind]} />
                  <span>{item.label}</span>
                </Sidebar.MenuButton>
                {typeof count === "number" ? (
                  <Sidebar.MenuBadge className="text-muted-foreground tabular-nums">
                    {count.toLocaleString()}
                  </Sidebar.MenuBadge>
                ) : null}
              </Sidebar.MenuItem>
            );
          })}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  );
}

/** The entity section: back row · separator · title · one item per group. */
function SectionNav({
  section,
  renderLink,
}: {
  readonly section: SidebarSection;
  readonly renderLink: (item: NavItem) => ReactElement;
}): ReactNode {
  const backItem: NavItem = {
    slug: "__back",
    label: section.back.label,
    href: section.back.href,
    isActive: false,
    kind: "collection",
  };
  return (
    <>
      <Sidebar.Group data-slot="sidebar-section-back" className="pb-0">
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              tooltip={section.back.label}
              render={renderLink(backItem) as LinkElement}
              className="text-muted-foreground"
            >
              <CaretLeftIcon aria-hidden />
              <span>{section.back.label}</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Group>
      <Sidebar.Separator className="mx-2 w-auto" />
      <Sidebar.Group data-slot="sidebar-section">
        <Sidebar.GroupLabel className="h-auto flex-col items-start gap-0 py-1 group-data-[collapsible=icon]:hidden">
          <span className="truncate font-semibold text-sidebar-foreground text-sm">
            {section.title}
          </span>
          {section.subtitle ? (
            <span className="truncate font-normal text-muted-foreground text-xs">
              {section.subtitle}
            </span>
          ) : null}
        </Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {section.items.map((item) => (
              <Sidebar.MenuItem key={item.id}>
                <Sidebar.MenuButton
                  isActive={item.isActive}
                  tooltip={item.label}
                  render={
                    renderLink({
                      slug: item.id,
                      label: item.label,
                      href: item.href,
                      isActive: item.isActive,
                      kind: "collection",
                    }) as LinkElement
                  }
                >
                  <NamedIcon name={item.icon} fallback="Rows" />
                  <span>{item.label}</span>
                </Sidebar.MenuButton>
                {item.badge !== undefined && item.badge !== null ? (
                  <Sidebar.MenuBadge className="text-muted-foreground">
                    {item.badge}
                  </Sidebar.MenuBadge>
                ) : null}
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </>
  );
}

/** The 32px tinted mark: the host logo, else the brand's initial. */
function BrandMark({
  logo,
  name,
}: {
  readonly logo?: ReactNode;
  readonly name: string;
}): ReactNode {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar-primary-foreground [&_img]:size-5 [&_svg]:size-5"
    >
      {logo ?? <span className="font-semibold text-sm">{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}

export function AppSidebar({
  config,
  currentPath,
  basePath,
  renderLink = defaultRenderLink,
  logo,
  brandSubtitle,
  footer,
  extraGroups,
  counts,
  section,
  onSearch,
  homeLabel = "Overview",
}: AppSidebarProps): ReactNode {
  const nav = buildNav(config, { basePath, currentPath });
  const home = homeHref(basePath);
  const name = config.branding.name;

  // The brand block links home (the dashboard), routed through the same
  // `renderLink` as the nav so it uses the host's framework `Link`.
  const homeItem: NavItem = {
    slug: "__home",
    label: homeLabel,
    href: home,
    isActive: currentPath === home,
    kind: "collection",
    icon: DEFAULT_NAV_ICONS.home,
  };
  const brandLink = cloneElement(
    renderLink({ ...homeItem, label: name }) as LinkElement,
    {
      "data-slot": "sidebar-brand",
      "aria-label": `${name} — ${homeLabel}`,
      className: cn(
        "flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!",
      ),
    },
    <BrandMark logo={logo} name={name} />,
    <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
      <span className="truncate font-semibold">{name}</span>
      {brandSubtitle ? (
        <span className="truncate text-muted-foreground text-xs">{brandSubtitle}</span>
      ) : null}
    </span>,
  );

  return (
    // `inset` floats the content area as a rounded, bordered panel (see
    // `AdminShell`); `icon` collapses to a rail (tooltips on every item).
    <Sidebar.Root variant="inset" collapsible="icon">
      <Sidebar.Header>
        {brandLink}
        {onSearch ? (
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                type="button"
                tooltip="Search"
                onClick={onSearch}
                data-slot="sidebar-search"
                className="border border-sidebar-border bg-background/60 text-muted-foreground shadow-xs hover:bg-background"
              >
                <MagnifyingGlassIcon aria-hidden />
                <span className="flex-1">Search…</span>
                <Kbd.Root className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd.Root>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        ) : null}
      </Sidebar.Header>
      <Sidebar.Content>
        {section ? (
          <SectionNav section={section} renderLink={renderLink} />
        ) : (
          <>
            <NavGroup items={[homeItem]} renderLink={renderLink} />
            {nav.groups.map((group) => (
              <NavGroup
                key={group.label}
                label={group.label}
                items={group.items}
                renderLink={renderLink}
                counts={counts}
              />
            ))}
            {extraGroups?.map((group) => (
              <NavGroup
                key={group.label}
                label={group.label}
                items={group.items}
                renderLink={renderLink}
              />
            ))}
          </>
        )}
      </Sidebar.Content>
      {footer ? <Sidebar.Footer>{footer}</Sidebar.Footer> : null}
      <Sidebar.Rail />
    </Sidebar.Root>
  );
}
