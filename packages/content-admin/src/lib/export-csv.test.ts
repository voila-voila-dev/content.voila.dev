// CSV export. `buildCsv` is pure, so the quoting rules and the per-kind
// flattening are covered here; `downloadCsv` only exists in a browser and is
// left to the manual pass.

import { describe, expect, test } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { buildCsv, csvFilename, csvValue } from "./export-csv";

const films = defineCollection({
  slug: "films",
  titleField: "title",
  fields: {
    title: fields.string({ localized: true, required: true }),
    notes: fields.richText(),
    shotIn: fields.geo(),
    year: fields.number({ integer: true }),
    featured: fields.boolean(),
    formats: fields.multiSelect({ options: ["35mm", "DCP"] }),
    secret: fields.string({ hidden: true }),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en-US", "pt-PT"], defaultLocale: "en-US" },
  collections: { films },
});
const collection = config.collections.films;

describe("csvValue", () => {
  test("passes scalars through", () => {
    expect(csvValue("Vertigo", collection.fields.year)).toBe("Vertigo");
    expect(csvValue(1958, collection.fields.year)).toBe("1958");
    expect(csvValue(true, collection.fields.featured)).toBe("true");
  });

  test("renders nothing for an absent value", () => {
    expect(csvValue(null, collection.fields.year)).toBe("");
    expect(csvValue(undefined, collection.fields.year)).toBe("");
  });

  test("takes a localized record's default locale", () => {
    const value = { "en-US": "The Glass House", "pt-PT": "A Casa de Vidro" };
    expect(csvValue(value, collection.fields.title, "en-US")).toBe("The Glass House");
    expect(csvValue(value, collection.fields.title, "pt-PT")).toBe("A Casa de Vidro");
  });

  test("falls back to any translated locale when the default is missing", () => {
    const value = { "pt-PT": "A Casa de Vidro" };
    expect(csvValue(value, collection.fields.title, "en-US")).toBe("A Casa de Vidro");
  });

  test("flattens rich text to its plain text", () => {
    const doc = [
      { type: "paragraph", children: [{ text: "One" }] },
      { type: "paragraph", children: [{ text: "Two" }] },
    ];
    expect(csvValue(doc, collection.fields.notes)).toBe("One\nTwo");
  });

  test("renders a geo point as a coordinate pair", () => {
    expect(csvValue({ lat: 38.7223, lng: -9.1393 }, collection.fields.shotIn)).toBe(
      "38.7223, -9.1393",
    );
  });

  test("joins a list with semicolons so commas stay the delimiter", () => {
    expect(csvValue(["35mm", "DCP"], collection.fields.formats)).toBe("35mm; DCP");
  });
});

describe("buildCsv", () => {
  test("writes a header of id plus every non-hidden field", () => {
    const csv = buildCsv([], { collection });
    expect(csv.split("\r\n")[0]).toBe("id,title,notes,shotIn,year,featured,formats");
  });

  test("writes one CRLF-terminated row per record", () => {
    const csv = buildCsv(
      [
        { id: "a", title: { "en-US": "Vertigo" }, year: 1958 },
        { id: "b", title: { "en-US": "Chungking" }, year: 1994 },
      ],
      { collection, fields: ["title", "year"], defaultLocale: "en-US" },
    );
    expect(csv.split("\r\n")).toEqual(["id,title,year", "a,Vertigo,1958", "b,Chungking,1994"]);
  });

  test("quotes cells containing a comma, a quote or a newline", () => {
    const csv = buildCsv([{ id: "a", title: { "en-US": 'He said "go", then left' } }], {
      collection,
      fields: ["title"],
      defaultLocale: "en-US",
    });
    expect(csv.split("\r\n")[1]).toBe('a,"He said ""go"", then left"');
  });

  test("leaves a missing field as an empty cell rather than 'undefined'", () => {
    const csv = buildCsv([{ id: "a" }], { collection, fields: ["title", "year"] });
    expect(csv.split("\r\n")[1]).toBe("a,,");
  });

  test("honours an explicit column order", () => {
    const csv = buildCsv([], { collection, fields: ["year", "title"] });
    expect(csv.split("\r\n")[0]).toBe("id,year,title");
  });
});

describe("csvFilename", () => {
  test("names the file by collection and day so exports sort", () => {
    expect(csvFilename("films", new Date("2026-09-10T14:00:00Z"))).toBe("films-2026-09-10.csv");
  });
});
