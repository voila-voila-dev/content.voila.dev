// The registry resolver. Given a set of item names, walk the
// `registryDependencies` graph to produce an install plan: the items in
// dependency-first order (so a dependency is written before the file that
// imports it), the merged npm `dependencies`, and the deduped file list. Errors
// are explicit and actionable — unknown item, dependency cycle, or a conflict
// (two items wanting the same npm package at different versions, or the same
// target file from different sources).

import {
  fileTarget,
  type Registry,
  type RegistryFile,
  type RegistryItem,
  type RegistryItemType,
} from "./types";

/** A user-facing resolver failure — the CLI prints the message and exits non-zero. */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

/** Look up an item by name, or `undefined` if the catalog has none. */
export function getItem(registry: Registry, name: string): RegistryItem | undefined {
  return registry.items.find((item) => item.name === name);
}

/** All items, optionally filtered to a single type, in catalog order. */
export function listItems(registry: Registry, type?: RegistryItemType): RegistryItem[] {
  return registry.items.filter((item) => type === undefined || item.type === type);
}

export interface ResolvedPlan {
  /** Items to install, dependencies before dependents, each once. */
  readonly items: ReadonlyArray<RegistryItem>;
  /** Merged npm dependencies across all items, as name → version range. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** Every file to write, deduped by install target. */
  readonly files: ReadonlyArray<RegistryFile>;
}

function requireItem(registry: Registry, name: string): RegistryItem {
  const item = getItem(registry, name);
  if (!item) {
    const available = registry.items.map((i) => i.name).join(", ");
    throw new RegistryError(`Unknown registry item "${name}". Available: ${available}.`);
  }
  return item;
}

/**
 * Resolve `names` into an ordered install plan. Dependencies are emitted before
 * the items that need them (post-order DFS), each item once even when reached by
 * several paths.
 */
export function resolve(registry: Registry, names: ReadonlyArray<string>): ResolvedPlan {
  const ordered: RegistryItem[] = [];
  const done = new Set<string>();
  // Names on the current DFS path, for cycle detection.
  const onPath = new Set<string>();

  function visit(name: string, trail: ReadonlyArray<string>): void {
    if (done.has(name)) return;
    if (onPath.has(name)) {
      throw new RegistryError(`Dependency cycle: ${[...trail, name].join(" → ")}.`);
    }
    const item = requireItem(registry, name);
    onPath.add(name);
    for (const dep of item.registryDependencies ?? []) {
      visit(dep, [...trail, name]);
    }
    onPath.delete(name);
    done.add(name);
    ordered.push(item);
  }

  for (const name of names) visit(name, []);

  return {
    items: ordered,
    dependencies: mergeDependencies(ordered),
    files: mergeFiles(ordered),
  };
}

/** Merge npm deps across items; clashing version ranges for one package error. */
function mergeDependencies(items: ReadonlyArray<RegistryItem>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const item of items) {
    for (const [pkg, range] of Object.entries(item.dependencies ?? {})) {
      const existing = merged[pkg];
      if (existing !== undefined && existing !== range) {
        throw new RegistryError(`Conflicting versions for "${pkg}": "${existing}" and "${range}".`);
      }
      merged[pkg] = range;
    }
  }
  return merged;
}

/** Collect files across items; the same target from different sources errors. */
function mergeFiles(items: ReadonlyArray<RegistryItem>): RegistryFile[] {
  const byTarget = new Map<string, RegistryFile>();
  for (const item of items) {
    for (const file of item.files) {
      const target = fileTarget(file);
      const existing = byTarget.get(target);
      if (existing !== undefined && existing.path !== file.path) {
        throw new RegistryError(
          `Two items write "${target}" from different sources ("${existing.path}" and "${file.path}").`,
        );
      }
      byTarget.set(target, file);
    }
  }
  return [...byTarget.values()];
}
