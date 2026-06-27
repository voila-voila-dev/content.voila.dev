// MapView is client-only — maplibre-gl loads via a WebGL-guarded dynamic import
// inside the effect, so under happy-dom (no WebGL) the guard bails and the
// library never loads. These tests cover the render shell + the early-return
// guard and the pure `readPoint` parser; the maplibre path needs a real browser.

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { MapView, readPoint } from "./map-view";

afterEach(cleanup);

const places = defineCollection({
  slug: "places",
  titleField: "name",
  fields: { name: fields.string(), location: fields.geo() },
});

describe("readPoint", () => {
  test("accepts a numeric { lat, lng }", () => {
    expect(readPoint({ lat: 48.85, lng: 2.35 })).toEqual({ lat: 48.85, lng: 2.35 });
  });
  test("rejects null, non-objects, and missing/non-numeric coordinates", () => {
    expect(readPoint(null)).toBeNull();
    expect(readPoint("x")).toBeNull();
    expect(readPoint({ lat: 1 })).toBeNull();
    expect(readPoint({ lat: "1", lng: 2 })).toBeNull();
  });
});

describe("MapView", () => {
  test("renders a map container without loading WebGL/maplibre under happy-dom", () => {
    render(
      <MapView.Root
        collection={places}
        rows={[{ id: "1", name: "Paris", location: { lat: 48.85, lng: 2.35 } }]}
        geoField="location"
        mapStyleUrl="https://example.com/style.json"
      />,
    );
    // The container renders (the maplibre init is guarded out without WebGL).
    expect(screen.getByLabelText("Map")).toBeDefined();
  });

  test("exposes the map-view slot on its root", () => {
    const { baseElement } = render(
      <MapView.Root
        collection={places}
        rows={[]}
        geoField="location"
        mapStyleUrl="https://example.com/style.json"
      />,
    );
    expect(baseElement.querySelector('[data-slot="map-view"]')).not.toBeNull();
  });
});
