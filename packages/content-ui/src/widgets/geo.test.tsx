// The geo edit widget. The lat/lng inputs are fully exercised here; the map
// picker (`createGeoInput`) is client-only — maplibre loads via a WebGL-guarded
// dynamic import, so under happy-dom (no WebGL) only its container shell renders.

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type Field, fields } from "@voila/content";
import { useState } from "react";
import { createGeoInput, GeoInput, nextGeo, readGeoValue } from "./geo";

afterEach(cleanup);

const geoField = fields.geo({ required: true }) as unknown as Field;

describe("readGeoValue", () => {
  test("returns numeric coordinates that are present", () => {
    expect(readGeoValue({ lat: 48.85, lng: 2.35 })).toEqual({ lat: 48.85, lng: 2.35 });
  });
  test("drops non-numeric / missing coordinates and rejects non-objects", () => {
    expect(readGeoValue({ lat: 1 })).toEqual({ lat: 1 });
    expect(readGeoValue({ lat: "1", lng: 2 })).toEqual({ lng: 2 });
    expect(readGeoValue(null)).toEqual({});
    expect(readGeoValue("x")).toEqual({});
  });
});

describe("nextGeo", () => {
  test("both coordinates → a full point", () => {
    expect(nextGeo("48.85", "2.35")).toEqual({ lat: 48.85, lng: 2.35 });
  });
  test("both empty → undefined (clears the field)", () => {
    expect(nextGeo("", "")).toBeUndefined();
  });
  test("a partial entry keeps the present half so the schema flags the gap", () => {
    expect(nextGeo("48.85", "")).toEqual({ lat: 48.85 });
    expect(nextGeo("", "2.35")).toEqual({ lng: 2.35 });
  });
});

describe("GeoInput", () => {
  function setup(value?: unknown) {
    const onChange = mock();
    render(<GeoInput value={value} onChange={onChange} field={geoField} id="places-location" />);
    return { onChange };
  }

  test("renders the current coordinates in the lat/lng inputs", () => {
    setup({ lat: 48.85, lng: 2.35 });
    expect((screen.getByLabelText("Latitude") as HTMLInputElement).value).toBe("48.85");
    expect((screen.getByLabelText("Longitude") as HTMLInputElement).value).toBe("2.35");
  });

  test("editing latitude emits the full point, keeping the existing longitude", () => {
    const { onChange } = setup({ lat: 1, lng: 2 });
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith({ lat: 10, lng: 2 });
  });

  test("clearing both inputs emits undefined", () => {
    const emitted: unknown[] = [];
    function Controlled() {
      const [value, setValue] = useState<unknown>({ lat: 1, lng: 2 });
      return (
        <GeoInput
          value={value}
          onChange={(v) => {
            emitted.push(v);
            setValue(v);
          }}
          field={geoField}
          id="places-location"
        />
      );
    }
    render(<Controlled />);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "" } });
    expect(emitted.at(-1)).toBeUndefined();
  });

  test("wires the field id + required/aria for the form label", () => {
    setup();
    const lat = screen.getByLabelText("Latitude");
    expect(lat.id).toBe("places-location");
    expect(lat.getAttribute("aria-required")).toBe("true");
  });
});

describe("createGeoInput", () => {
  test("renders the lat/lng inputs plus the map picker shell (no WebGL in tests)", () => {
    const Widget = createGeoInput({ mapStyleUrl: "https://example.com/style.json" });
    render(
      <Widget
        value={{ lat: 48.85, lng: 2.35 }}
        onChange={() => {}}
        field={geoField}
        id="places-location"
      />,
    );
    expect(screen.getByLabelText("Latitude")).toBeDefined();
    expect(screen.getByLabelText("Location picker")).toBeDefined();
  });
});
