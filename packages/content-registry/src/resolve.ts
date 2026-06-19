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
    files: mergeFiles(ordered, transitiveDeps(registry)),
  };
}

/**
 * Map of item name → the set of items it depends on, directly or transitively.
 * Used to allow an item to override a file it inherits from a dependency (the
 * "flavored override" seam) while still rejecting collisions between unrelated
 * items. Safe to walk eagerly: `resolve` rejects cycles before this runs.
 */
function transitiveDeps(registry: Registry): Map<string, Set<string>> {
  const cache = new Map<string, Set<string>>();
  function deps(name: string): Set<string> {
    const hit = cache.get(name);
    if (hit) return hit;
    const set = new Set<string>();
    cache.set(name, set);
    for (const dep of getItem(registry, name)?.registryDependencies ?? []) {
      set.add(dep);
      for (const d of deps(dep)) set.add(d);
    }
    return set;
  }
  for (const item of registry.items) deps(item.name);
  return cache;
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

/**
 * Collect files across items, deduped by install target. The same target from
 * two different sources is a conflict and errors — *unless* the later item
 * depends (transitively) on the one it collides with, in which case it is a
 * deliberate override and the dependent's file wins. `items` is dependency-first,
 * so the overriding item is always the current one.
 */
function mergeFiles(
  items: ReadonlyArray<RegistryItem>,
  deps: Map<string, Set<string>>,
): RegistryFile[] {
  const byTarget = new Map<string, { file: RegistryFile; owner: string }>();
  for (const item of items) {
    for (const file of item.files) {
      const target = fileTarget(file);
      const existing = byTarget.get(target);
      if (existing !== undefined && existing.file.path !== file.path) {
        if (!deps.get(item.name)?.has(existing.owner)) {
          throw new RegistryError(
            `Two items write "${target}" from different sources ("${existing.file.path}" and "${file.path}").`,
          );
        }
      }
      byTarget.set(target, { file, owner: item.name });
    }
  }
  return [...byTarget.values()].map((entry) => entry.file);
}
