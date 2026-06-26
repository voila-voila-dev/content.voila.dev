// MapView — plots a collection's rows as markers on a maplibre-gl map, reading
// each row's `geo` field (`{ lat, lng }`); a marker's popup shows the document
// title. CLIENT-ONLY by construction: the heavy maplibre-gl library is loaded
// with a dynamic `import()` INSIDE the effect, guarded by `typeof window` + a
// WebGL check — so it never runs during SSR, never pulls WebGL into a happy-dom
// test, and stays out of every other admin bundle. maplibre-gl is an OPTIONAL
// peer dependency: the import only resolves when the host has installed it
// (required to use a map view). The host also includes maplibre-gl's small
// stylesheet once in its app entry (`import "maplibre-gl/dist/maplibre-gl.css"`)
// — a ~40 KB CSS file, kept out of the dynamic path so bundlers extract it
// normally. The host supplies the style URL and fetches the rows (see the
// bounded "load all" the list screen does for map views).

import type { Collection } from "@voila/content";
import { cn } from "@voila/ui/cn";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { documentTitle } from "./detail-view";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";
import { activeMapStyleUrl, followThemeStyle } from "./lib/map-style";
import { hasWebGL } from "./lib/webgl";

export interface MapViewProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** The `geo` field whose `{ lat, lng }` value positions each marker. */
  readonly geoField: string;
  /** A maplibre style URL the host provides (e.g. a MapTiler/MapLibre style). */
  readonly mapStyleUrl: string;
  /** Dark-theme basemap; when set, the map follows the admin's `.dark` theme. */
  readonly darkStyleUrl?: string;
  /** Open a row when its marker is clicked. */
  readonly onRowClick?: (row: Doc) => void;
  /** Extra fields to list in a marker's popup, below the title. */
  readonly cardFields?: readonly string[];
  readonly className?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A field value as a short popup string (objects/arrays are JSON; null → "—"). */
function popupValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface Point {
  readonly lat: number;
  readonly lng: number;
}

/** A `{ lat, lng }` point with numeric coordinates, or `null`. */
export function readPoint(value: unknown): Point | null {
  if (value === null || typeof value !== "object") return null;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

export function MapView({
  collection,
  rows,
  geoField,
  cardFields,
  mapStyleUrl,
  darkStyleUrl,
  onRowClick,
  className,
}: MapViewProps): ReactNode {
  const containerRef = useRef<HTMLElement>(null);
  // Read rows/handlers live so a re-init isn't forced by the host re-creating the
  // `rows` array each render; the marker set only refreshes on the signature.
  const liveRef = useRef({ collection, rows, geoField, cardFields, onRowClick });
  liveRef.current = { collection, rows, geoField, cardFields, onRowClick };

  // A stable fingerprint of the plotted points — the effect re-inits only when a
  // marker's id or coordinates actually change (not on every parent render).
  const signature = useMemo(
    () =>
      rows
        .map(
          (row) =>
            `${String(row.id)}@${JSON.stringify(row[geoField])}#${(cardFields ?? [])
              .map((f) => JSON.stringify(row[f]))
              .join(",")}`,
        )
        .join("|"),
    [rows, geoField, cardFields],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container || !hasWebGL()) return;

    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let stopThemeFollow: (() => void) | undefined;

    void (async () => {
      // maplibre-gl is an optional peer dep; if it's absent (or WebGL/map init
      // throws — e.g. the WebGL2 context the library needs) leave the empty
      // container rather than crashing the admin with an unhandled rejection.
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        const live = liveRef.current;

        map = new maplibre.Map({
          container: containerRef.current,
          style: activeMapStyleUrl(mapStyleUrl, darkStyleUrl),
          center: [0, 0],
          zoom: 1,
        });
        // Swap to the dark basemap when the admin theme toggles (no-op without a
        // dark variant). Markers are DOM overlays, so they survive the swap.
        stopThemeFollow = followThemeStyle(map, mapStyleUrl, darkStyleUrl);
        const bounds = new maplibre.LngLatBounds();
        let plotted = 0;
        for (const row of live.rows) {
          const point = readPoint(row[live.geoField]);
          if (point === null) continue;
          plotted += 1;
          const title = documentTitle(live.collection, row) ?? "";
          // Title plus any configured card fields, as escaped popup HTML.
          const lines = (live.cardFields ?? []).flatMap((key) => {
            const field = live.collection.fields[key];
            if (!field) return [];
            const label = escapeHtml(getFieldLabel(key, field));
            const value = escapeHtml(popupValue(row[key]));
            return [`<div><span class="opacity-60">${label}:</span> ${value}</div>`];
          });
          const popup = new maplibre.Popup({ closeButton: false }).setHTML(
            `<div class="text-sm"><strong>${escapeHtml(title)}</strong>${lines.join("")}</div>`,
          );
          const marker = new maplibre.Marker()
            .setLngLat([point.lng, point.lat])
            .setPopup(popup)
            .addTo(map);
          // Read the handler live at click time, not snapshotted — the effect
          // doesn't re-run when only `onRowClick`'s identity changes.
          marker.getElement().addEventListener("click", () => liveRef.current.onRowClick?.(row));
          bounds.extend([point.lng, point.lat]);
        }
        if (plotted > 0) map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 });
      } catch {
        // Optional maplibre missing or map init failed — degrade to empty.
      }
    })();

    return () => {
      cancelled = true;
      stopThemeFollow?.();
      map?.remove();
    };
  }, [mapStyleUrl, darkStyleUrl, signature]);

  // The styled box is an OUTER element React owns; maplibre attaches to the inner
  // `<section>` and adds its own `maplibregl-map` class there. Keeping that inner
  // className constant means a parent re-render (a new `className` prop, a layout
  // change) never rewrites it — otherwise React would drop maplibre's class, the
  // map would lose `position: relative`, and its canvas would escape its box.
  // maplibre's control chrome (zoom buttons, attribution) ships light; invert it
  // — hue-rotated back so link colors survive — when the map sits in dark mode.
  return (
    <div
      className={cn(
        "h-[60vh] w-full overflow-hidden rounded-lg border",
        "dark:[&_.maplibregl-ctrl]:hue-rotate-180 dark:[&_.maplibregl-ctrl]:invert",
        className,
      )}
    >
      <section ref={containerRef} aria-label="Map" className="h-full w-full" />
    </div>
  );
}
