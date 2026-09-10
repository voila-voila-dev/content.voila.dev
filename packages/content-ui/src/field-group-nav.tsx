// FieldGroupNav — the MOBILE section strip for a grouped detail/edit page: one
// tab per resolved group (icon + label) in a horizontal scroller. On `lg` and
// up the sections live in the sidebar (the shell's `SidebarSection` swap), so
// this hides itself there by default (`mobileOnly`). Presentational and
// router-agnostic: the host owns which group is active and what selecting one
// does (`onSelect`, e.g. a router navigate).

import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";
import type { ResolvedGroup } from "./lib/groups";
import { NamedIcon, resolveIcon } from "./lib/icons";

/** Resolve a Phosphor icon by name (bare or `…Icon` suffixed); unknown → undefined. */
export const resolveGroupIcon = resolveIcon;

export interface FieldGroupNavProps {
  readonly groups: readonly ResolvedGroup[];
  /** The active group's id. */
  readonly activeGroup: string;
  /** Called with a group id when the user selects it. */
  readonly onSelect: (id: string) => void;
  /** Accessible name of the strip. Defaults to "Sections". */
  readonly title?: string;
  /** Hide from `lg` up (the sidebar carries the sections there). Default `true`. */
  readonly mobileOnly?: boolean;
  readonly className?: string;
}

export function FieldGroupNav({
  groups,
  activeGroup,
  onSelect,
  title,
  mobileOnly = true,
  className,
}: FieldGroupNavProps): ReactNode {
  return (
    <nav
      aria-label={title ?? "Sections"}
      data-slot="field-group-nav"
      className={cn(
        "flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden px-4 py-2 sm:px-6",
        mobileOnly && "lg:hidden",
        className,
      )}
    >
      {groups.map((group) => {
        const isActive = group.id === activeGroup;
        return (
          <button
            key={group.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(group.id)}
            className={cn(
              "flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <NamedIcon name={group.icon} className="size-4" />
            {group.label}
          </button>
        );
      })}
    </nav>
  );
}
