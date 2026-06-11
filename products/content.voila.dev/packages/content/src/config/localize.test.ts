// Locale resolution: the fallback chain (`localeChain`) and per-locale
// document flattening (`localizeDocument`). The REST `?locale=` path builds on
// exactly these two; their semantics are pinned here once.

import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { type I18nConfig, localeChain } from "./i18n";
import { localizeDocument } from "./localize";

const i18n: I18nConfig = {
  locales: ["en-US", "fr-FR", "de-DE"],
  defaultLocale: "en-US",
  fallback: { "de-DE": ["fr-FR"] },
};

describe("localeChain", () => {
  it("is the locale, its fallbacks, then the default", () => {
    expect(localeChain(i18n, "de-DE")).toEqual(["de-DE", "fr-FR", "en-US"]);
  });

  it("appends the default when no fallback is declared", () => {
    expect(localeChain(i18n, "fr-FR")).toEqual(["fr-FR", "en-US"]);
  });

  it("never repeats a locale", () => {
    expect(localeChain(i18n, "en-US")).toEqual(["en-US"]);
    const looped: I18nConfig = {
      locales: ["en-US", "fr-FR"],
      defaultLocale: "en-US",
      fallback: { "fr-FR": ["fr-FR", "en-US"] },
    };
    expect(localeChain(looped, "fr-FR")).toEqual(["fr-FR", "en-US"]);
  });
});

describe("localizeDocument", () => {
  const posts = defineCollection({
    slug: "posts",
    fields: {
      title: fields.string({ localized: true }),
      slug: fields.slug(),
    },
  });
  const config = defineConfig({
    branding: { name: "Test" },
    i18n: { locales: ["en-US", "fr-FR", "de-DE"], defaultLocale: "en-US" },
    collections: { posts },
  });
  const postFields = config.collections.posts.fields;

  const doc = {
    id: "p1",
    title: { "en-US": "Hello", "fr-FR": "Bonjour" },
    slug: "hello",
  };

  it("flattens localized fields to the first locale carrying a value", () => {
    expect(localizeDocument(postFields, doc, ["fr-FR", "en-US"])).toEqual({
      id: "p1",
      title: "Bonjour",
      slug: "hello",
    });
    expect(localizeDocument(postFields, doc, ["de-DE", "en-US"]).title).toBe("Hello");
  });

  it("yields undefined when no locale along the chain has a value", () => {
    expect(localizeDocument(postFields, doc, ["de-DE"]).title).toBeUndefined();
  });

  it("returns the same reference when nothing is localized", () => {
    const plain = defineCollection({ slug: "plain", fields: { name: fields.string() } });
    const cfg = defineConfig({ branding: { name: "T" }, collections: { plain } });
    const row = { id: "x", name: "n" };
    expect(localizeDocument(cfg.collections.plain.fields, row, ["en-US"])).toBe(row);
  });

  it("leaves a malformed localized value (non-record) untouched", () => {
    const weird = { id: "p2", title: "not-a-record", slug: "x" };
    expect(localizeDocument(postFields, weird, ["en-US"])).toBe(weird);
  });
});
