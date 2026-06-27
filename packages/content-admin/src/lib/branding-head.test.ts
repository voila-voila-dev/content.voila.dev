import { describe, expect, test } from "bun:test";
import { brandingHead } from "./branding-head";

describe("brandingHead", () => {
  test("emits a title meta from branding.title", () => {
    expect(brandingHead({ title: "Acme" }).meta).toEqual([{ title: "Acme" }]);
  });

  test("omits the title meta when unset", () => {
    expect(brandingHead({}).meta).toEqual([]);
  });

  test("emits a favicon link with an inferred type", () => {
    expect(brandingHead({ favicon: "/icon.svg" }).links).toEqual([
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ]);
    expect(brandingHead({ favicon: "/icon.png" }).links).toEqual([
      { rel: "icon", href: "/icon.png", type: "image/png" },
    ]);
    expect(brandingHead({ favicon: "/favicon.ico" }).links).toEqual([
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ]);
  });

  test("infers the type from a data-URI favicon", () => {
    const links = brandingHead({ favicon: "data:image/svg+xml,%3Csvg/%3E" }).links;
    expect(links[0]?.type).toBe("image/svg+xml");
  });

  test("omits the type for an unknown favicon shape", () => {
    expect(brandingHead({ favicon: "/icon" }).links).toEqual([{ rel: "icon", href: "/icon" }]);
  });

  test("falls back to the default favicon when branding has none", () => {
    expect(brandingHead({}, { defaultFavicon: "/fallback.svg" }).links).toEqual([
      { rel: "icon", href: "/fallback.svg", type: "image/svg+xml" },
    ]);
  });

  test("branding.favicon overrides the default", () => {
    expect(
      brandingHead({ favicon: "/brand.png" }, { defaultFavicon: "/fallback.svg" }).links,
    ).toEqual([{ rel: "icon", href: "/brand.png", type: "image/png" }]);
  });

  test("emits no links when there is no favicon at all", () => {
    expect(brandingHead({}).links).toEqual([]);
  });
});
