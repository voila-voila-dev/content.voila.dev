// Phosphor icon lookup by name. The config refers to icons by their Phosphor
// export name (`"FileText"`), so groups, collections and nav items can declare
// one without importing a component. The namespace import is the registry: it
// exports every icon in both the bare and the `…Icon`-suffixed spelling.

import * as Icons from "@phosphor-icons/react";
import type { ComponentType, ReactNode } from "react";

export type IconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}>;

const iconRegistry = Icons as unknown as Record<string, IconComponent | undefined>;

/** Resolve a Phosphor icon by name (bare or `…Icon` suffixed); unknown → undefined. */
export function resolveIcon(name?: string): IconComponent | undefined {
  if (!name) return undefined;
  return iconRegistry[name] ?? iconRegistry[`${name}Icon`];
}

/** Render a named icon (or `fallback` when the name is unknown). */
export function NamedIcon({
  name,
  fallback,
  className,
}: {
  readonly name?: string;
  readonly fallback?: string;
  readonly className?: string;
}): ReactNode {
  const Icon = resolveIcon(name) ?? resolveIcon(fallback);
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}
