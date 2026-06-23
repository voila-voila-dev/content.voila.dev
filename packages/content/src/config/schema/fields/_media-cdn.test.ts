// The image-CDN transform URL layer: Cloudflare option rendering (including
// the sharp→Cloudflare fit mapping), URL assembly against relative and
// absolute sources, the no-op fast path, and named-variant resolution from a
// media field's `transforms` meta.

import { describe, expect, it } from "bun:test";
import { cloudflareImageCdn, cloudflareImageOptions, mediaVariantUrls } from "./_media-cdn";
import { media } from "./media";

describe("cloudflareImageOptions", () => {
  it("renders every transform key, sorted and comma-joined", () => {
    expect(
      cloudflareImageOptions({
        width: 400,
        height: 300,
        fit: "cover",
        quality: 80,
        format: "webp",
      }),
    ).toBe("fit=cover,format=webp,height=300,quality=80,width=400");
  });

  it("renders only the keys present", () => {
    expect(cloudflareImageOptions({ width: 120 })).toBe("width=120");
    expect(cloudflareImageOptions({})).toBe("");
  });

  it("maps sharp fit names to Cloudflare's", () => {
    expect(cloudflareImageOptions({ fit: "cover" })).toBe("fit=cover");
    expect(cloudflareImageOptions({ fit: "contain" })).toBe("fit=contain");
    expect(cloudflareImageOptions({ fit: "fill" })).toBe("fit=crop");
    expect(cloudflareImageOptions({ fit: "inside" })).toBe("fit=scale-down");
    expect(cloudflareImageOptions({ fit: "outside" })).toBe("fit=cover");
  });
});

describe("cloudflareImageCdn", () => {
  it("builds a same-zone URL from a root-relative source", () => {
    const cdn = cloudflareImageCdn();
    expect(cdn("/admin/api/_media/abc/file", { width: 400, format: "webp" })).toBe(
      "/cdn-cgi/image/format=webp,width=400/admin/api/_media/abc/file",
    );
  });

  it("keeps an absolute source URL intact (remote origin fetch)", () => {
    const cdn = cloudflareImageCdn();
    expect(cdn("https://assets.example.com/cat.png", { width: 64 })).toBe(
      "/cdn-cgi/image/width=64/https://assets.example.com/cat.png",
    );
  });

  it("mounts under a base origin (trailing slash trimmed)", () => {
    const cdn = cloudflareImageCdn({ base: "https://cdn.example.com/" });
    expect(cdn("/media/x.png", { width: 10 })).toBe(
      "https://cdn.example.com/cdn-cgi/image/width=10/media/x.png",
    );
  });

  it("returns the source untouched for an empty transform", () => {
    const cdn = cloudflareImageCdn({ base: "https://cdn.example.com" });
    expect(cdn("/media/x.png", {})).toBe("/media/x.png");
  });
});

describe("mediaVariantUrls", () => {
  const value = { url: "/admin/api/_media/abc/file" };

  it("resolves a field's named transforms at render time", () => {
    const field = media({
      transforms: {
        thumb: { width: 160, height: 160, fit: "cover" },
        hero: { width: 1600, format: "avif" },
      },
    });
    const variants = mediaVariantUrls(field.meta.transforms, value, cloudflareImageCdn());
    expect(variants).toEqual({
      thumb: "/cdn-cgi/image/fit=cover,height=160,width=160/admin/api/_media/abc/file",
      hero: "/cdn-cgi/image/format=avif,width=1600/admin/api/_media/abc/file",
    });
  });

  it("returns an empty record when the field declares no transforms", () => {
    const field = media();
    expect(mediaVariantUrls(field.meta.transforms, value, cloudflareImageCdn())).toEqual({});
  });

  it("works with any ImageCdn implementation", () => {
    const variants = mediaVariantUrls(
      { tiny: { width: 8 } },
      value,
      (url, t) => `https://imgproxy.example/w${t.width}${url}`,
    );
    expect(variants).toEqual({ tiny: "https://imgproxy.example/w8/admin/api/_media/abc/file" });
  });
});
