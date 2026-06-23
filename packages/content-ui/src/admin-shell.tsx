// AdminShell — the top-level admin layout. Wraps `AppSidebar` (nav from config)
// and an inset content area with a header bar carrying the sidebar trigger, an
// optional page title, and an actions slot. The page body goes in `children`;
// `ListView` / `DetailView` render inside it in later slices. Like the sidebar,
// it's router-agnostic — pass `renderLink` to wire nav entries to a framework
// `Link`, and `currentPath` to highlight the active collection.

import type { NormalizedConfig } from "@voila/content";
import { Sidebar } from "@voila/ui";
import type { ReactElement, ReactNode } from "react";
import { AppSidebar, type AppSidebarProps } from "./app-sidebar";
import type { NavItem } from "./lib/nav";
import { ThemeToggle } from "./theme-toggle";

export interface AdminShellProps {
  readonly config: NormalizedConfig;
  /** Current pathname, used to highlight the active nav item. */
  readonly currentPath?: string;
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /** Render the anchor element for a nav item (e.g. a framework `Link`). */
  readonly renderLink?: (item: NavItem) => ReactElement;
  /** Content for the sidebar footer (e.g. a user menu / sign-out). */
  readonly sidebarFooter?: ReactNode;
  /** Title shown in the header bar. */
  readonly title?: ReactNode;
  /** Actions shown on the right of the header bar (e.g. a "New" button). */
  readonly headerActions?: ReactNode;
  /** Whether the sidebar starts expanded. Defaults to open. */
  readonly defaultSidebarOpen?: boolean;
  /** Extra nav groups appended after collections/singletons (e.g. custom screens). */
  readonly extraGroups?: AppSidebarProps["extraGroups"];
  readonly children?: ReactNode;
}

export function AdminShell({
  config,
  currentPath,
  basePath,
  renderLink,
  sidebarFooter,
  title,
  headerActions,
  defaultSidebarOpen = true,
  extraGroups,
  children,
}: AdminShellProps): ReactNode {
  return (
    <Sidebar.Provider defaultOpen={defaultSidebarOpen}>
      <AppSidebar
        config={config}
        currentPath={currentPath}
        basePath={basePath}
        renderLink={renderLink}
        footer={sidebarFooter}
        extraGroups={extraGroups}
      />
      <Sidebar.Inset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <Sidebar.Trigger />
          {/* Persistent app chrome, not a document heading — each page view owns
              its single <h1>, so this stays a plain styled label to avoid two
              competing top-level headings on a screen. */}
          {title ? <span className="text-sm font-medium">{title}</span> : null}
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <ThemeToggle />
          </div>
        </header>
        {/* `Sidebar.Inset` is itself the `<main>` landmark, so the body is a
            plain padded `<div>` — a nested second `<main>` would give the screen
            two main landmarks. */}
        <div className="flex-1 p-4">{children}</div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
