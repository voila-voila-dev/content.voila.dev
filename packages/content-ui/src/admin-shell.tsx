// AdminShell — the top-level admin layout. Wraps `AppSidebar` (nav from config)
// and the inset content panel. There is deliberately NO shell header bar: each
// page renders its own single `PageLayout.Header` (trigger · back · title ·
// actions · theme), so a screen never stacks two bars. The shell provides the
// contexts pages read — `ShellContext` (the sidebar section swap + "in shell"
// flag) and `I18nProvider` (the config's locales, for localized display) — and
// owns the sidebar's open state: an icon rail when collapsed, auto-collapsed
// below the `lg` breakpoint, toggled with ⌘B. Router-agnostic like the sidebar:
// pass `renderLink` to wire nav entries to a framework `Link`.

import type { NormalizedConfig } from "@voila/content";
import { Sidebar } from "@voila.dev/ui/sidebar";
import { type ReactElement, type ReactNode, useCallback, useEffect, useState } from "react";
import { AppSidebar, type AppSidebarProps } from "./app-sidebar";
import { I18nProvider } from "./lib/i18n";
import type { NavItem } from "./lib/nav";
import { ShellContext, type SidebarSection } from "./lib/shell-context";

export interface AdminShellProps {
  readonly config: NormalizedConfig;
  /** Current pathname, used to highlight the active nav item. */
  readonly currentPath?: string;
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /** Render the anchor element for a nav item (e.g. a framework `Link`). */
  readonly renderLink?: (item: NavItem) => ReactElement;
  /** Logo shown in the sidebar's brand block beside the config's `branding.name`. */
  readonly logo?: ReactNode;
  /** Muted line under the brand name (an environment, a plan, "Admin"). */
  readonly brandSubtitle?: ReactNode;
  /** Content for the sidebar footer (e.g. `UserMenu`). */
  readonly sidebarFooter?: ReactNode;
  /** Whether the sidebar starts expanded. Defaults to open (collapsed below `lg`). */
  readonly defaultSidebarOpen?: boolean;
  /** Extra nav groups appended after collections/singletons (e.g. custom screens). */
  readonly extraGroups?: AppSidebarProps["extraGroups"];
  /** The sidebar layout (see `AppSidebarProps.navGroups`). */
  readonly navGroups?: AppSidebarProps["navGroups"];
  /** Document count per collection slug, shown as a badge on its nav item. */
  readonly counts?: AppSidebarProps["counts"];
  /** Called when the sidebar's search entry (⌘K) is activated. Omit to hide it. */
  readonly onSearch?: () => void;
  /** Locale the admin displays localized values in; defaults to `i18n.defaultLocale`. */
  readonly displayLocale?: string;
  /**
   * BCP 47 locale for formatting dates, numbers and relative times throughout
   * the admin (see `I18nContextValue.locale`). Defaults to the browser's.
   */
  readonly locale?: string;
  readonly children?: ReactNode;
}

/** Below this width the sidebar starts (and snaps back) collapsed. */
const AUTO_COLLAPSE_QUERY = "(max-width: 1023px)";

export function AdminShell({
  config,
  currentPath,
  basePath,
  renderLink,
  logo,
  brandSubtitle,
  sidebarFooter,
  defaultSidebarOpen = true,
  extraGroups,
  navGroups,
  counts,
  onSearch,
  displayLocale,
  locale,
  children,
}: AdminShellProps): ReactNode {
  const [open, setOpen] = useState(defaultSidebarOpen);
  const [section, setSectionState] = useState<SidebarSection | null>(null);
  const setSection = useCallback((next: SidebarSection | null) => setSectionState(next), []);

  // Auto-collapse to the icon rail on narrow desktops (≤1023px) and re-expand
  // when the viewport grows back — the user's own toggle wins in between.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(AUTO_COLLAPSE_QUERY);
    const apply = (matches: boolean) => setOpen(matches ? false : defaultSidebarOpen);
    apply(media.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [defaultSidebarOpen]);

  return (
    <ShellContext.Provider value={{ inShell: true, section, setSection }}>
      <I18nProvider i18n={config.i18n} displayLocale={displayLocale} locale={locale}>
        <Sidebar.Provider open={open} onOpenChange={setOpen}>
          <AppSidebar
            config={config}
            currentPath={currentPath}
            basePath={basePath}
            renderLink={renderLink}
            logo={logo}
            brandSubtitle={brandSubtitle}
            footer={sidebarFooter}
            extraGroups={extraGroups}
            navGroups={navGroups}
            counts={counts}
            section={section}
            onSearch={onSearch}
          />
          {/* The inset variant floats the content as a bordered, rounded panel
              inset from the viewport. Cap it to the viewport height (minus the
              kit's `m-2` on `md`, 1rem total) and clip, so each page pins its own
              header and owns its scroll. */}
          <Sidebar.Inset className="h-svh overflow-hidden border md:h-[calc(100svh-1rem)]">
            {/* `Sidebar.Inset` is the `<main>` landmark; the body is a plain div.
                A `PageLayout` page fills it exactly; a plain screen overflows and
                this `overflow-y-auto` scrolls it. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </Sidebar.Inset>
        </Sidebar.Provider>
      </I18nProvider>
    </ShellContext.Provider>
  );
}
