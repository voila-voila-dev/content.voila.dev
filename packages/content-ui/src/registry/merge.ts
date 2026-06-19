// Shared registry merge — layer a caller's per-key overrides over a base map,
// returning the base verbatim when there are no overrides. Both the display and
// edit registries are `Record<key, Widget>` maps, so they share this helper.

export function mergeMaps<W>(
  base: Readonly<Record<string, W>>,
  overrides?: Readonly<Record<string, W>>,
): Readonly<Record<string, W>> {
  return overrides ? { ...base, ...overrides } : base;
}
