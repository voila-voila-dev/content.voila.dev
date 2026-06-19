// Image transforms as URLs. The engine never rasterizes — a `MediaTransform`
// becomes a URL on an image CDN that resizes on the fly (Cloudflare Image
// Resizing here; the `ImageCdn` seam fits any URL-based service). Client-safe
// and pure: feed it the `url` of a stored `MediaValue` (the `_media/:id/file`
// route, which a CDN can fetch like any origin path) and render the result in
// an `<img src>`. Named variants come from the media *field*'s `transforms`
// meta — the upload pipeline is field-agnostic, so variants resolve at render
// time, not at upload.

import type { MediaFit, MediaTransform, MediaValue } from "./media";

/** Turn a source image URL + transform into a URL serving the derived image. */
export type ImageCdn = (sourceUrl: string, transform: MediaTransform) => string;

export interface CloudflareImageCdnOpts {
  /**
   * Prefix the `/cdn-cgi/image/...` path is mounted under — the zone origin
   * (`https://cdn.example.com`) when building absolute URLs from another
   * origin. Defaults to none: same-zone, root-relative URLs.
   */
  readonly base?: string;
}

// `MediaTransform.fit` uses sharp's vocabulary; Cloudflare's resizer has its
// own. `fill` (stretch to exact size) has no CF equivalent — `crop` is the
// closest exact-dimensions mode; `outside` (cover the box, no crop) maps to
// `cover` (CF always crops to the box, the nearest behavior).
const CF_FIT: Record<MediaFit, string> = {
  cover: "cover",
  contain: "contain",
  fill: "crop",
  inside: "scale-down",
  outside: "cover",
};

/** Render a transform as Cloudflare Image Resizing options, sorted and
 *  comma-joined (e.g. `fit=cover,format=webp,width=400`). */
export function cloudflareImageOptions(transform: MediaTransform): string {
  const options: string[] = [];
  if (transform.width !== undefined) options.push(`width=${transform.width}`);
  if (transform.height !== undefined) options.push(`height=${transform.height}`);
  if (transform.fit !== undefined) options.push(`fit=${CF_FIT[transform.fit]}`);
  if (transform.quality !== undefined) options.push(`quality=${transform.quality}`);
  if (transform.format !== undefined) options.push(`format=${transform.format}`);
  return options.sort().join(",");
}

/**
 * Cloudflare Image Resizing: `/cdn-cgi/image/<options>/<source>` on any zone
 * with the feature enabled. The source is the image's own URL — root-relative
 * (`/admin/api/_media/<id>/file`) stays same-zone; an absolute URL makes
 * Cloudflare fetch a remote origin.
 *
 * An empty transform returns the source untouched — no resizer hop for a
 * no-op.
 */
export function cloudflareImageCdn(opts?: CloudflareImageCdnOpts): ImageCdn {
  const base = opts?.base?.endsWith("/") ? opts.base.slice(0, -1) : (opts?.base ?? "");
  return (sourceUrl, transform) => {
    const options = cloudflareImageOptions(transform);
    if (options.length === 0) return sourceUrl;
    return `${base}/cdn-cgi/image/${options}/${sourceUrl.replace(/^\//, "")}`;
  };
}

/**
 * Resolve a media field's named `transforms` against a stored value:
 * `mediaVariantUrls(field.meta.transforms, doc.cover, cdn)` →
 * `{ thumb: "/cdn-cgi/image/…/…", hero: … }`. Returns `{}` when the field
 * declares no transforms.
 */
export function mediaVariantUrls(
  transforms: Readonly<Record<string, MediaTransform>> | undefined,
  value: Pick<MediaValue, "url">,
  cdn: ImageCdn,
): Readonly<Record<string, string>> {
  if (transforms === undefined) return {};
  const variants: Record<string, string> = {};
  for (const [name, transform] of Object.entries(transforms)) {
    variants[name] = cdn(value.url, transform);
  }
  return variants;
}
