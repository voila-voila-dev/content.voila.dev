// Shared basemap-style helpers for the maplibre surfaces (`MapView`, the geo
// location picker). The defaults are free, key-less OpenFreeMap vector styles, so
// maps work with no API key; hosts override them in `content.config.ts`
// (`map.styleUrl` / `map.darkStyleUrl`) or per-admin via `defineAdmin`. When a
// dark variant is configured the basemap follows the admin's `.dark` theme.

/** OpenFreeMap "liberty" — the free, key-less light basemap (default). */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** OpenFreeMap "dark" — the matching dark basemap (default dark variant). */
export const DEFAULT_MAP_DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

/** True while the admin is in dark mode (the `.dark` class on `<html>`). */
function prefersDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/**
 * The basemap URL that applies right now: the dark variant while the admin is in
 * dark mode (when one is configured), else the light/explicit style.
 */
export function activeMapStyleUrl(styleUrl: string, darkStyleUrl?: string): string {
  return darkStyleUrl && prefersDark() ? darkStyleUrl : styleUrl;
}

/**
 * Swap a map's basemap when the admin theme toggles. Watches `<html>`'s class for
 * `.dark` changes and `setStyle`s the matching variant. maplibre `Marker`s are
 * DOM overlays, not part of the style, so they survive the swap — there's nothing
 * to re-add. A no-op (returning a no-op disposer) when no dark variant is set or
 * outside the browser. Returns a cleanup that stops observing.
 */
export function followThemeStyle(
  map: import("maplibre-gl").Map,
  styleUrl: string,
  darkStyleUrl: string | undefined,
): () => void {
  if (!darkStyleUrl || typeof document === "undefined") return () => {};
  let applied = activeMapStyleUrl(styleUrl, darkStyleUrl);
  const observer = new MutationObserver(() => {
    const next = activeMapStyleUrl(styleUrl, darkStyleUrl);
    if (next === applied) return;
    applied = next;
    map.setStyle(next);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
