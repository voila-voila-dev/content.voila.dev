// Geo edit widget — a latitude/longitude input pair, plus (optionally) a
// click-to-place maplibre mini-map. The two number inputs always render: they're
// SSR-safe, dependency-free, and enough to set a point by hand or paste
// coordinates. `createGeoInput({ mapStyleUrl })` adds the map picker — the heavy
// maplibre-gl loads via a WebGL-guarded dynamic `import()` INSIDE the effect,
// exactly like `MapView`, so it never runs during SSR / in tests and stays out
// of admins that don't edit a geo field. The config-driven admin wires the
// picker in automatically from `admin.mapStyleUrl`; consumers using
// `CollectionForm` directly get the plain input pair from the default registry.
//
// Emits `{ lat, lng }` (or `undefined` when both inputs are cleared) so the value
// re-validates against the geo field's own `{ lat, lng }` schema.

import { cn } from "@voila/ui/cn";
import { Input } from "@voila/ui/input";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { activeMapStyleUrl, followThemeStyle } from "../lib/map-style";
import { hasWebGL } from "../lib/webgl";
import { type DisplayWidgetProps, Empty } from "./display";
import type { EditWidget, EditWidgetProps } from "./edit";

/** Read a geo value loosely — each coordinate is present only if it's a number. */
export function readGeoValue(value: unknown): { lat?: number; lng?: number } {
  if (value === null || typeof value !== "object") return {};
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return {
    ...(typeof lat === "number" ? { lat } : {}),
    ...(typeof lng === "number" ? { lng } : {}),
  };
}

/** Trim a coordinate to ~1 m precision without trailing-zero noise. */
function formatCoord(n: number): string {
  return n.toFixed(5).replace(/\.?0+$/, "");
}

/**
 * Read-only geo renderer for tables + detail rows: the `{ lat, lng }` point as
 * trimmed `lat, lng`, linking out to OpenStreetMap. Without it, a geo field
 * falls through to the raw-JSON display.
 */
export function GeoDisplay({ value }: DisplayWidgetProps): ReactNode {
  const { lat, lng } = readGeoValue(value);
  if (lat === undefined || lng === undefined) return <Empty />;
  return (
    <a
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in OpenStreetMap"
      className="text-primary hover:underline"
    >
      {formatCoord(lat)}, {formatCoord(lng)}
    </a>
  );
}

/**
 * Build the next field value from the two coordinate strings. Both empty → the
 * field clears (`undefined`, so a `required` check fires); a partial entry keeps
 * the one coordinate present so the struct schema flags the missing half.
 */
export function nextGeo(
  latRaw: string,
  lngRaw: string,
): { lat?: number; lng?: number } | undefined {
  const lat = latRaw === "" ? undefined : Number(latRaw);
  const lng = lngRaw === "" ? undefined : Number(lngRaw);
  if (lat === undefined && lng === undefined) return undefined;
  const point: { lat?: number; lng?: number } = {};
  if (lat !== undefined && !Number.isNaN(lat)) point.lat = lat;
  if (lng !== undefined && !Number.isNaN(lng)) point.lng = lng;
  return point;
}

/** The latitude/longitude input pair — the always-available, SSR-safe editor. */
export function GeoInput({
  value,
  onChange,
  id,
  labelId,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const { lat, lng } = readGeoValue(value);
  const latStr = lat === undefined ? "" : String(lat);
  const lngStr = lng === undefined ? "" : String(lng);
  const required = field.meta.required === true;
  const latHintId = `${id}-lat-hint`;
  const lngHintId = `${id}-lng-hint`;
  // Each input's accessible name composes the field's own label (the form's
  // `labelId`, e.g. "Location") with its coordinate hint → "Location latitude".
  const labelledBy = (hintId: string) => [labelId, hintId].filter(Boolean).join(" ");
  // Both coordinates are required together and share the field's one error, so
  // wire the same aria onto each (not just the latitude half).
  const aria = {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    "aria-required": required ? (true as const) : undefined,
  };
  return (
    <div className="flex gap-2">
      <div className="flex-1 space-y-1">
        <span id={latHintId} className="block text-muted-foreground text-xs">
          Latitude
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          aria-labelledby={labelledBy(latHintId)}
          {...aria}
          value={latStr}
          placeholder="48.8566"
          disabled={disabled}
          onChange={(e) => onChange(nextGeo(e.target.value, lngStr))}
        />
      </div>
      <div className="flex-1 space-y-1">
        <span id={lngHintId} className="block text-muted-foreground text-xs">
          Longitude
        </span>
        <Input
          id={`${id}-lng`}
          type="number"
          inputMode="decimal"
          step="any"
          aria-labelledby={labelledBy(lngHintId)}
          {...aria}
          value={lngStr}
          placeholder="2.3522"
          disabled={disabled}
          onChange={(e) => onChange(nextGeo(latStr, e.target.value))}
        />
      </div>
    </div>
  );
}

export interface CreateGeoInputOptions {
  /** A maplibre style URL the picker renders (e.g. `admin.mapStyleUrl`). */
  readonly mapStyleUrl: string;
  /** Dark-theme basemap; when set, the picker follows the admin's `.dark` theme. */
  readonly darkStyleUrl?: string;
}

/**
 * Build a geo edit widget that pairs the {@link GeoInput} fields with a
 * click-to-place maplibre map. Mirrors `createMediaInput`: the admin layer wires
 * it from config so geo fields get a map picker without per-field setup.
 */
export function createGeoInput(options: CreateGeoInputOptions): EditWidget {
  return function GeoInputWithPicker(props: EditWidgetProps): ReactNode {
    return (
      <div className="space-y-2">
        <GeoInput {...props} />
        <GeoMapPicker
          value={props.value}
          mapStyleUrl={options.mapStyleUrl}
          darkStyleUrl={options.darkStyleUrl}
          disabled={props.disabled}
          onChange={props.onChange}
        />
      </div>
    );
  };
}

interface GeoMapPickerProps {
  readonly value: unknown;
  readonly mapStyleUrl: string;
  readonly darkStyleUrl?: string;
  readonly disabled?: boolean;
  readonly onChange: (value: unknown) => void;
}

/** Move (or create) the draggable marker at a point, wiring drag → onChange. */
function placeMarker(
  maplibre: typeof import("maplibre-gl"),
  map: import("maplibre-gl").Map,
  markerRef: { current: import("maplibre-gl").Marker | undefined },
  lat: number,
  lng: number,
  liveRef: { current: { onChange: (v: unknown) => void; disabled?: boolean } },
): void {
  if (markerRef.current) {
    markerRef.current.setLngLat([lng, lat]);
    return;
  }
  const marker = new maplibre.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map);
  marker.on("dragend", () => {
    if (liveRef.current.disabled) return;
    const p = marker.getLngLat();
    liveRef.current.onChange({ lat: p.lat, lng: p.lng });
  });
  markerRef.current = marker;
}

/**
 * The maplibre half: a small map where a click (or a marker drag) sets the
 * point. CLIENT-ONLY by construction — the dynamic import is WebGL-guarded inside
 * the effect, so SSR and happy-dom render only the container shell.
 */
function GeoMapPicker({
  value,
  mapStyleUrl,
  darkStyleUrl,
  disabled,
  onChange,
}: GeoMapPickerProps): ReactNode {
  const containerRef = useRef<HTMLElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | undefined>(undefined);
  const markerRef = useRef<import("maplibre-gl").Marker | undefined>(undefined);
  const maplibreRef = useRef<typeof import("maplibre-gl") | undefined>(undefined);
  // Read the value/handlers live so the init effect (which runs once per style)
  // always sees the latest, and a click/drag isn't snapshotted to a stale value.
  const liveRef = useRef({ value, onChange, disabled });
  liveRef.current = { value, onChange, disabled };
  // maplibre-gl is an optional peer dep; if the import or map init fails, hide
  // the map and leave the lat/lng inputs as the working editor.
  const [unavailable, setUnavailable] = useState(false);

  const { lat, lng } = readGeoValue(value);

  // Init the map once per style. Initial center reads the live value (via the
  // ref) so it isn't a dependency that would re-init on every coordinate edit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container || !hasWebGL()) return;

    let cancelled = false;
    let stopThemeFollow: (() => void) | undefined;
    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        maplibreRef.current = maplibre;
        const start = readGeoValue(liveRef.current.value);
        const hasPoint = start.lat !== undefined && start.lng !== undefined;
        const map = new maplibre.Map({
          container: containerRef.current,
          style: activeMapStyleUrl(mapStyleUrl, darkStyleUrl),
          center: hasPoint ? [start.lng as number, start.lat as number] : [0, 0],
          zoom: hasPoint ? 12 : 1,
        });
        mapRef.current = map;
        // Swap to the dark basemap when the admin theme toggles (no-op without a
        // dark variant). The marker is a DOM overlay, so it survives the swap.
        stopThemeFollow = followThemeStyle(map, mapStyleUrl, darkStyleUrl);
        map.on("click", (event) => {
          if (liveRef.current.disabled) return;
          liveRef.current.onChange({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
        if (hasPoint) {
          placeMarker(maplibre, map, markerRef, start.lat as number, start.lng as number, liveRef);
        }
      } catch {
        // No maplibre-gl (it's optional) or WebGL/map init failed — degrade to
        // the lat/lng inputs instead of an unhandled rejection + broken map.
        if (!cancelled) setUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
      stopThemeFollow?.();
      mapRef.current?.remove();
      mapRef.current = undefined;
      markerRef.current = undefined;
    };
  }, [mapStyleUrl, darkStyleUrl]);

  // Keep the marker in sync when the value changes from the inputs (or clears).
  // The map view is deliberately left where it is — placing or nudging a pin
  // shouldn't yank the map back to center; the user keeps their current frame.
  useEffect(() => {
    const maplibre = maplibreRef.current;
    const map = mapRef.current;
    if (!maplibre || !map) return;
    if (lat === undefined || lng === undefined) {
      markerRef.current?.remove();
      markerRef.current = undefined;
      return;
    }
    placeMarker(maplibre, map, markerRef, lat, lng, liveRef);
  }, [lat, lng]);

  // maplibre absent / failed → render nothing; the GeoInput pair still works.
  if (unavailable) return null;

  // The styled box is an OUTER element React owns; maplibre attaches to the inner
  // `<section>`, where it adds its own `maplibregl-map` class (which supplies
  // `position: relative`). That inner className is constant, so a parent
  // re-render — e.g. `disabled` toggling while the field's per-field Save is in
  // flight — never rewrites it. Putting the toggling classes on the same element
  // maplibre mutated would make React drop the `maplibregl-map` class on the next
  // render, and the map's absolutely-positioned canvas would escape to the
  // top-left of the page, leaving the box empty.
  return (
    <div
      className={cn(
        "h-64 w-full overflow-hidden rounded-md border",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <section ref={containerRef} aria-label="Location picker" className="h-full w-full" />
    </div>
  );
}
