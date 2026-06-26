// FieldGroupNav — the left sub-navigation for a grouped detail/edit page: one
// item per resolved group (icon + label), a horizontal scroller on mobile and a
// vertical column on `lg`. Presentational and router-agnostic, like the rest of
// `@voila/content-ui`: the host owns which group is active (`activeGroup`, e.g.
// derived from `?group=`) and what selecting one does (`onSelect`, e.g. a router
// navigate). Modeled on the guide-scpi admin's `PageLayout.Navigation`. Icons
// resolve by Phosphor name from `@voila/ui/icons`; an unknown name renders no
// icon (the label still shows).

import { cn } from "@voila/ui/cn";
import * as Icons from "@voila/ui/icons";
import type { ComponentType, ReactNode } from "react";
import type { ResolvedGroup } from "./lib/groups";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

// `@voila/ui/icons` re-exports every Phosphor icon as a named export; the
// namespace import is the registry. Phosphor ships both the bare (`FileText`)
// and the suffixed (`FileTextIcon`) forms, so we tolerate either spelling.
const iconRegistry = Icons as unknown as Record<string, IconComponent | undefined>;

/** Resolve a Phosphor icon by name (bare or `…Icon` suffixed); unknown → undefined. */
export function resolveGroupIcon(name?: string): IconComponent | undefined {
  if (!name) return undefined;
  return iconRegistry[name] ?? iconRegistry[`${name}Icon`];
}

export interface FieldGroupNavProps {
  readonly groups: readonly ResolvedGroup[];
  /** The active group's id. */
  readonly activeGroup: string;
  /** Called with a group id when the user selects it. */
  readonly onSelect: (id: string) => void;
  /** Optional heading shown above the items (desktop only). */
  readonly title?: string;
  readonly className?: string;
}

export function FieldGroupNav({
  groups,
  activeGroup,
  onSelect,
  title,
  className,
}: FieldGroupNavProps): ReactNode {
  return (
    <nav
      aria-label={title ?? "Sections"}
      className={cn(
        "flex shrink-0 border-border",
        "flex-row gap-1 overflow-x-auto overflow-y-hidden border-b p-2",
        // Desktop: a fixed-width vertical column whose right border runs the full
        // height of the page frame (it sits beside, not inside, the scroll body).
        "lg:w-56 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-4",
        className,
      )}
    >
      {title ? (
        <h3 className="mb-2 hidden font-medium text-muted-foreground text-sm lg:block">{title}</h3>
      ) : null}
      <div className="flex flex-row gap-1 lg:flex-col">
        {groups.map((group) => {
          const isActive = group.id === activeGroup;
          const Icon = resolveGroupIcon(group.icon);
          return (
            <button
              key={group.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(group.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent font-medium text-accent-foreground",
              )}
            >
              {Icon ? <Icon className="size-4" aria-hidden /> : null}
              {group.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
