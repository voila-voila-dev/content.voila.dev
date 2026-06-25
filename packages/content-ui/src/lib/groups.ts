// resolveFieldGroups — turn a collection/singleton's optional `groups` config
// into the ordered, resolved groups the detail/edit page renders as a left
// sub-nav + one card per group. Group order and field order both come from the
// config arrays. Fields named by no group fall into a synthesized trailing
// "General" group so nothing silently disappears; hidden fields stay filtered
// (the same eligibility logic `DetailView`/`CollectionForm` use for their flat
// layout). When the entity declares no groups, a single implicit "General"
// group holding every eligible field is returned — callers keep their flat
// layout in that case and use this only when groups are actually declared.

import type { Collection } from "@voila/content";
import { humanize } from "./humanize";

export interface ResolvedGroup {
  /** Stable id (from config, or `"general"` for the synthesized group). */
  readonly id: string;
  /** Display label: the group's `label`, else `humanize(id)`. */
  readonly label: string;
  /** Phosphor icon name, passed through from config (may be unknown). */
  readonly icon?: string;
  readonly description?: string;
  /** The group's field keys, in render order, after eligibility + dedupe. */
  readonly fieldKeys: readonly string[];
}

export interface ResolveFieldGroupsOptions {
  /**
   * Restrict to these field keys (in this order) before grouping — mirrors the
   * `fields` prop on `DetailView`/`CollectionForm`. When given, every named key
   * is eligible (including hidden ones, matching the flat layout's explicit
   * `fields` path); when omitted, all non-hidden fields are eligible.
   */
  readonly fields?: readonly string[];
}

/** The flat eligible keys — explicit `fields` (filtered to known keys) or every
 *  non-hidden field, mirroring `resolveRows`/`resolveFieldKeys`. */
function eligibleFieldKeys(collection: Collection, fields?: readonly string[]): string[] {
  if (fields) return fields.filter((k) => Object.hasOwn(collection.fields, k));
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
}

const GENERAL_ID = "general";

export function resolveFieldGroups(
  collection: Collection,
  opts?: ResolveFieldGroupsOptions,
): ResolvedGroup[] {
  const keys = eligibleFieldKeys(collection, opts?.fields);
  const configGroups = collection.groups ?? [];

  // No declared groups → one implicit group with every eligible field. Callers
  // gate the grouped renderer on `collection.groups`, so this is just a
  // well-defined fallback (useful on its own + keeps the return type uniform).
  if (configGroups.length === 0) {
    return [{ id: GENERAL_ID, label: "General", fieldKeys: keys }];
  }

  const eligible = new Set(keys);
  const used = new Set<string>();
  const groups: ResolvedGroup[] = configGroups.map((g) => {
    // Keep only eligible keys not already claimed by an earlier group (first
    // group wins), preserving the config's field order.
    const fieldKeys = g.fields.filter((k) => eligible.has(k) && !used.has(k));
    for (const k of fieldKeys) used.add(k);
    return {
      id: g.id,
      label: g.label ?? humanize(g.id),
      icon: g.icon,
      description: g.description,
      fieldKeys,
    };
  });

  // Eligible fields no group claimed land in a trailing "General" group —
  // merged into an author-declared `general` group if one already exists.
  const leftover = keys.filter((k) => !used.has(k));
  let out = groups;
  if (leftover.length > 0) {
    const hasGeneral = groups.some((g) => g.id === GENERAL_ID);
    out = hasGeneral
      ? groups.map((g) =>
          g.id === GENERAL_ID ? { ...g, fieldKeys: [...g.fieldKeys, ...leftover] } : g,
        )
      : [...groups, { id: GENERAL_ID, label: "General", fieldKeys: leftover }];
  }

  // Drop groups that resolved to nothing (all keys hidden/unknown/duplicated) —
  // an empty card and nav item would be noise.
  return out.filter((g) => g.fieldKeys.length > 0);
}
