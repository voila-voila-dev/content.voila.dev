// shell-context — the small piece of shared state the admin shell exposes to
// the pages rendered inside it. Two things ride on it:
//
//   • `inShell`: whether a page is mounted inside `AdminShell`. `PageLayout.Header`
//     reads it to know whether to render the sidebar trigger (it needs the kit's
//     `Sidebar.Provider`, which the shell supplies) — so the same page component
//     renders cleanly embedded elsewhere or in tests.
//   • `section`: the sidebar's "one nav surface at a time" swap. An entity page
//     (a document's detail/edit) registers a `SidebarSection` — a back row, the
//     document's title, and one item per field group — and the sidebar shows
//     THAT instead of the top-level tree while the page is mounted
//     (`useRegisterSidebarSection`, modeled on the tries.care shell).

import { createContext, type ReactNode, useContext, useEffect } from "react";

export interface SidebarSectionItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly isActive: boolean;
  /** Phosphor icon name. */
  readonly icon?: string;
  /** Optional trailing badge (a count, a status). */
  readonly badge?: ReactNode;
}

export interface SidebarSection {
  /** Heading shown above the items — the entity's title ("Fjords by Ferry"). */
  readonly title: string;
  /** Optional muted line under the title (the collection label, an id). */
  readonly subtitle?: string;
  /** The back row: where "‹ Posts" goes and what it says. */
  readonly back: { readonly href: string; readonly label: string };
  readonly items: readonly SidebarSectionItem[];
}

export interface ShellContextValue {
  readonly inShell: boolean;
  readonly section: SidebarSection | null;
  readonly setSection: (section: SidebarSection | null) => void;
}

const noop = () => {};

export const ShellContext = createContext<ShellContextValue>({
  inShell: false,
  section: null,
  setSection: noop,
});

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}

/**
 * Swap the sidebar to `section` for the lifetime of the calling component
 * (cleared on unmount, so leaving the entity restores the top-level tree). Pass
 * `null` to show the top-level tree explicitly. Safe outside a shell — a no-op.
 */
export function useRegisterSidebarSection(section: SidebarSection | null): void {
  const { setSection } = useShell();
  // Serialize so a fresh-but-equal object from each render doesn't thrash state.
  const key = JSON.stringify(section, (_k, v) =>
    typeof v === "object" && v !== null && "$$typeof" in v ? "[node]" : v,
  );
  useEffect(() => {
    setSection(section);
    return () => setSection(null);
    // `key` is the section's identity; `section` itself is a fresh object per render.
  }, [key, setSection]);
}
