import { describe, expect, test } from "bun:test";
import type { ResolvedAdminTheme } from "../types";
import { brandingHead } from "./branding-head";

function theme(partial: ResolvedAdminTheme = {}): ResolvedAdminTheme {
  return partial;
}

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

  test("emits no style tag when no theme is passed", () => {
    // A host that hasn't adopted the option keeps today's <head> exactly.
    expect(brandingHead({}).styles).toEqual([]);
  });

  test("emits a token style block for a configured accent", () => {
    const styles = brandingHead({}, { theme: theme({ accent: "#c0392b" }) }).styles;
    expect(styles).toHaveLength(1);
    expect(styles[0]?.children).toContain("--primary:");
    expect(styles[0]?.children).toContain(".dark {");
  });

  test("takes the accent from content when config sets none", () => {
    // The whole point: the editor's colour, resolved server-side, lands in the
    // first byte of HTML rather than after hydration.
    const styles = brandingHead({}, { theme: theme(), brand: { accent: "#0b3d91" } }).styles;
    expect(styles[0]?.children).toContain("--primary:");
  });

  test("a configured accent still wins over the content one", () => {
    const styles = brandingHead(
      {},
      { theme: theme({ accent: "#ffffff" }), brand: { accent: "#0b3d91" } },
    ).styles;
    expect(styles[0]?.children).toContain("oklch(0.85 0 0)");
  });

  test("emits no style tag for a theme that changes nothing", () => {
    // Defaults resolved by `defineAdmin` are not a reason to ship CSS; the
    // no-config admin has to render byte-for-byte as before.
    expect(brandingHead({}, { theme: theme() }).styles).toEqual([]);
  });

  test("uses the content logo as the favicon when branding sets none", () => {
    // One upload in the settings singleton brands the tab as well as the shell.
    expect(brandingHead({}, { brand: { logo: "/uploads/mark.png" } }).links).toEqual([
      { rel: "icon", href: "/uploads/mark.png", type: "image/png" },
    ]);
  });

  test("branding.favicon still outranks the content logo", () => {
    expect(
      brandingHead(
        { favicon: "/brand.svg" },
        { brand: { logo: "/uploads/mark.png" }, defaultFavicon: "/fallback.svg" },
      ).links[0]?.href,
    ).toBe("/brand.svg");
  });

  test("the content logo outranks the host default", () => {
    expect(
      brandingHead({}, { brand: { logo: "/uploads/mark.png" }, defaultFavicon: "/fallback.svg" })
        .links[0]?.href,
    ).toBe("/uploads/mark.png");
  });
});
