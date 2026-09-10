import { describe, expect, test } from "bun:test";
import type { ResolvedAdminTheme } from "../types";
import { brandSingletons, readBrandSource } from "./brand-source";

/** A theme as `defineAdmin` normalizes it — unset keys stay absent. */
function theme(partial: ResolvedAdminTheme = {}): ResolvedAdminTheme {
  return partial;
}

describe("brandSingletons", () => {
  test("names nothing when the theme reads no content", () => {
    // The default admin must not add a query per request just by existing.
    expect(brandSingletons(theme())).toEqual([]);
  });

  test("names the singleton each path points at", () => {
    expect(brandSingletons(theme({ accentFrom: "settings.primaryColor" }))).toEqual(["settings"]);
  });

  test("de-duplicates two paths into the same singleton", () => {
    // Colour and logo normally live side by side, and that must stay one read.
    expect(
      brandSingletons(theme({ accentFrom: "settings.primaryColor", logoFrom: "settings.logo" })),
    ).toEqual(["settings"]);
  });

  test("ignores a path with no field part", () => {
    expect(brandSingletons(theme({ accentFrom: "settings" }))).toEqual([]);
    expect(brandSingletons(theme({ accentFrom: "settings." }))).toEqual([]);
    expect(brandSingletons(theme({ accentFrom: ".primaryColor" }))).toEqual([]);
  });
});

describe("readBrandSource", () => {
  const docs = {
    settings: {
      primaryColor: "#c0392b",
      logo: { url: "https://cdn.example/logo.png", mime: "image/png" },
    },
  };

  test("reads the accent the editors picked", () => {
    expect(readBrandSource(theme({ accentFrom: "settings.primaryColor" }), docs).accent).toBe(
      "#c0392b",
    );
  });

  test("reads the logo url out of a media value", () => {
    expect(readBrandSource(theme({ logoFrom: "settings.logo" }), docs).logo).toBe(
      "https://cdn.example/logo.png",
    );
  });

  test("accepts a plain string logo field", () => {
    // `logoFrom` may point at a url string field rather than a media upload.
    const source = readBrandSource(theme({ logoFrom: "settings.logo" }), {
      settings: { logo: "/logo.svg" },
    });
    expect(source.logo).toBe("/logo.svg");
  });

  test("a config accent wins over the content one", () => {
    // Config is the deliberate choice; `accentFrom` is the delegated one.
    const source = readBrandSource(
      theme({ accent: "#0b3d91", accentFrom: "settings.primaryColor" }),
      docs,
    );
    expect(source.accent).toBe("#0b3d91");
  });

  test("yields nothing when the singleton has never been saved", () => {
    // A fresh project has no settings row; the admin must render its defaults,
    // not crash on a null document.
    expect(
      readBrandSource(theme({ accentFrom: "settings.primaryColor", logoFrom: "settings.logo" }), {
        settings: null,
      }),
    ).toEqual({});
  });

  test("yields nothing for empty or wrong-shaped values", () => {
    // A half-filled settings page is the normal state of a new project, so every
    // one of these has to fall through to the default theme rather than emit a
    // broken token or an <img> with no src.
    const source = readBrandSource(
      theme({ accentFrom: "settings.primaryColor", logoFrom: "settings.logo" }),
      { settings: { primaryColor: "   ", logo: { url: "" } } },
    );
    expect(source).toEqual({});
  });

  test("ignores a non-string accent", () => {
    const source = readBrandSource(theme({ accentFrom: "settings.primaryColor" }), {
      settings: { primaryColor: 42 },
    });
    expect(source.accent).toBeUndefined();
  });

  test("omits absent keys entirely rather than carrying undefined", () => {
    // The result is spread into `themeTokensCss`, which distinguishes "no
    // accent" from "an accent that is undefined".
    expect(Object.keys(readBrandSource(theme(), {}))).toEqual([]);
  });
});
