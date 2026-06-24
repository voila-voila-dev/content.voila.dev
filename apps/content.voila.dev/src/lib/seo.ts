import type { Organization, Thing, WebSite, WithContext } from "schema-dts";

/** Any JSON-LD node with the `@context` set, as produced by `schema-dts`. */
export type JsonLd = WithContext<Thing>;

/** Site-wide SEO defaults. Page-level props override these. */
export const SITE = {
  name: "content.voila.dev",
  /** Canonical origin. Must match `site` in astro.config.mjs. */
  url: "https://content.voila.dev",
  title: "content.voila.dev — the config-driven content framework",
  titleTemplate: "%s · content.voila.dev",
  description: "A config-driven, type-safe content framework built on modern web primitives.",
  /** Default Open Graph / Twitter share image (absolute or root-relative). */
  image: "/og.png",
  locale: "en_US",
  twitter: "@voiladev",
  themeColor: "#ffffff",
} as const;

export type OgType = "website" | "article" | "profile";

export interface SeoProps {
  /** Page title. Run through `SITE.titleTemplate` unless `titleTemplate` is `false`. */
  title?: string;
  /** When `false`, use `title` verbatim (e.g. the home page). */
  titleTemplate?: false;
  description?: string;
  /** Canonical URL. Defaults to the current request URL. */
  canonical?: string | URL;
  /** Share image, absolute or root-relative. Defaults to `SITE.image`. */
  image?: string;
  imageAlt?: string;
  type?: OgType;
  keywords?: string[];
  /** Control indexing. Defaults to index + follow. */
  noindex?: boolean;
  nofollow?: boolean;
  locale?: string;
  /** Article metadata (only emitted when `type === "article"`). */
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  /** Extra JSON-LD nodes, typed against schema.org via `schema-dts`. */
  jsonLd?: JsonLd | JsonLd[];
}

/** Resolve a possibly-relative URL against the canonical origin. */
export function absoluteUrl(path: string | URL, base: string | URL = SITE.url): string {
  return new URL(path.toString(), base.toString()).href;
}

/** Apply the title template unless disabled. */
export function formatTitle(title?: string, useTemplate = true): string {
  if (!title) return SITE.title;
  return useTemplate ? SITE.titleTemplate.replace("%s", title) : title;
}

/** The `<meta name="robots">` value from index/follow flags. */
export function robotsContent(noindex = false, nofollow = false): string {
  return [noindex ? "noindex" : "index", nofollow ? "nofollow" : "follow"].join(", ");
}

/** Default Organization node describing the publisher. */
export function organizationSchema(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl("/favicon.svg"),
  };
}

/** Default WebSite node (enables sitelinks search box if a search route exists). */
export function websiteSchema(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
  };
}

// U+2028 / U+2029 are valid in JSON but break a JS string context; build them
// from char codes so no literal separator ever appears in this source file.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const JSONLD_ESCAPES: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "&": "\\u0026",
  "'": "\\u0027",
  [LINE_SEP]: "\\u2028",
  [PARA_SEP]: "\\u2029",
};
const JSONLD_UNSAFE = new RegExp(`[<>&'${LINE_SEP}${PARA_SEP}]`, "g");

/**
 * Serialize JSON-LD for inlining in a `<script type="application/ld+json">`,
 * escaping characters that could break out of the script context (XSS-safe).
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(JSONLD_UNSAFE, (char) => JSONLD_ESCAPES[char] ?? char);
}
