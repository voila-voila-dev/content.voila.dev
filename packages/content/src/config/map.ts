// Basemap configuration for the admin's map surfaces — the list "Map" view and
// the geo field's location picker. Both default to free, key-less OpenFreeMap
// vector styles, so maps render out of the box with no API key; point these at
// your own style (e.g. a MapTiler/Mapbox style) for richer cartography. When
// `darkStyleUrl` is set, the basemap follows the admin's light/dark theme.

export interface MapConfig {
  /** Light (and default) vector style URL. */
  readonly styleUrl?: string;
  /**
   * Dark-theme variant. When set, the basemap swaps to it while the admin is in
   * dark mode and follows live theme toggles. Omit to keep one style in both
   * themes.
   */
  readonly darkStyleUrl?: string;
}
