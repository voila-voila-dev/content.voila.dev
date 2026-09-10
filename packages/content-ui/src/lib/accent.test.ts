import { describe, expect, test } from "bun:test";
import {
  accentColor,
  adjustForTheme,
  contrastForeground,
  formatOklch,
  hexToOklch,
  oklchLuminance,
  oklchToHex,
  parseHex,
  parseOklch,
  themeTokensCss,
} from "./accent";

/** Convert-or-throw: every hex in these tests is valid, and the throw keeps the
 *  assertions free of null-narrowing noise. */
function oklch(hex: string) {
  const color = hexToOklch(hex);
  if (color === null) throw new Error(`test fixture is not a hex colour: ${hex}`);
  return color;
}

describe("parseHex", () => {
  test("parses the six-digit form", () => {
    expect(parseHex("#ff8000")).toEqual({ r: 1, g: 128 / 255, b: 0 });
  });

  test("accepts a hex with no leading #", () => {
    // A `fields.color()` value is whatever the editor typed; both forms are
    // idiomatic and neither should silently disable the brand.
    expect(parseHex("ff8000")).toEqual(parseHex("#ff8000"));
  });

  test("expands the three-digit shorthand", () => {
    expect(parseHex("#c39")).toEqual(parseHex("#cc3399"));
  });

  test("is case-insensitive", () => {
    // Design tools export uppercase; the picker writes lowercase.
    expect(parseHex("#C0392B")).toEqual(parseHex("#c0392b"));
  });

  test("parses alpha forms but drops the alpha", () => {
    // A translucent accent would break contrast against both grounds, so the
    // colour is kept and the alpha discarded rather than the value rejected.
    expect(parseHex("#c0392b80")).toEqual(parseHex("#c0392b"));
    expect(parseHex("#c39f")).toEqual(parseHex("#cc3399"));
  });

  test("returns null for anything that is not a hex colour", () => {
    // Nothing user-typed may reach the generated stylesheet, so unparseable
    // input has to fail closed rather than be interpolated.
    for (const bad of ["", "#", "rebeccapurple", "#12345", "#gg0000", "rgb(1,2,3)", "#1234567"]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe("hexToOklch", () => {
  test("matches the published OKLCH of sRGB red", () => {
    // The canonical Oklab reference value — the one number that proves the
    // matrices and the cube roots are transcribed correctly.
    expect(hexToOklch("#ff0000")).toEqual({ l: 0.628, c: 0.258, h: 29.23 });
  });

  test("maps the achromatic ends to clean greys", () => {
    expect(hexToOklch("#ffffff")).toEqual({ l: 1, c: 0, h: 0 });
    expect(hexToOklch("#000000")).toEqual({ l: 0, c: 0, h: 0 });
  });

  test("pins the hue of a grey to 0 instead of numerical noise", () => {
    // atan2 on two near-zero components returns an arbitrary angle; a grey brand
    // should render as `oklch(L 0 0)`, not `oklch(L 0 217.43)`.
    expect(hexToOklch("#808080")).toEqual({ l: 0.6, c: 0, h: 0 });
  });

  test("keeps hue in 0–360 for colours below the a-axis", () => {
    const magenta = hexToOklch("#cc3399");
    expect(magenta?.h).toBeGreaterThan(0);
    expect(magenta?.h).toBeLessThan(360);
  });

  test("returns null for invalid input", () => {
    expect(hexToOklch("not a colour")).toBeNull();
  });
});

describe("formatOklch", () => {
  test("renders the CSS function the kit's tokens are written in", () => {
    expect(formatOklch({ l: 0.543, c: 0.174, h: 29.7 })).toBe("oklch(0.543 0.174 29.7)");
  });
});

describe("oklchLuminance", () => {
  test("round-trips to the WCAG luminance of the source colour", () => {
    // Red's relative luminance is the 0.2126 coefficient exactly, so this
    // pins the inverse Oklab matrices as well as the forward ones.
    expect(oklchLuminance(oklch("#ff0000"))).toBeCloseTo(0.2126, 4);
    expect(oklchLuminance(oklch("#ffffff"))).toBeCloseTo(1, 4);
    expect(oklchLuminance(oklch("#000000"))).toBeCloseTo(0, 4);
  });

  test("clamps an out-of-gamut accent into 0–1", () => {
    // Lightening a saturated brand for the dark theme can leave the sRGB gamut;
    // an unclamped channel would make the ink decision nonsense.
    const luminance = oklchLuminance({ l: 0.99, c: 0.4, h: 140 });
    expect(luminance).toBeGreaterThanOrEqual(0);
    expect(luminance).toBeLessThanOrEqual(1);
  });
});

describe("contrastForeground", () => {
  test("puts black ink on a light brand", () => {
    // The case that motivates the whole function: assuming white would make a
    // lemon-yellow brand's buttons unreadable.
    expect(contrastForeground(oklch("#f5e642"))).toEqual({ l: 0.145, c: 0, h: 0 });
  });

  test("puts white ink on a dark brand", () => {
    expect(contrastForeground(oklch("#0b3d91"))).toEqual({ l: 1, c: 0, h: 0 });
  });

  test("flips at the black/white contrast crossover", () => {
    // Either side of a mid tone the better ink genuinely changes, so the pick
    // has to be a measurement — the crossover is where the two WCAG contrast
    // ratios meet, not an eyeballed lightness.
    expect(contrastForeground({ l: 0.5, c: 0, h: 0 })).toEqual({ l: 1, c: 0, h: 0 });
    expect(contrastForeground({ l: 0.62, c: 0, h: 0 })).toEqual({ l: 0.145, c: 0, h: 0 });
  });
});

describe("adjustForTheme", () => {
  test("lifts a very dark brand so it survives the dark theme's ground", () => {
    // The dark theme paints on oklch(0.145); a navy at 0.386 reads as a
    // button-shaped hole in the sidebar.
    const navy = oklch("#0b3d91");
    expect(adjustForTheme(navy, "dark").l).toBe(0.62);
  });

  test("leaves a brand inside the band untouched", () => {
    const mid = { l: 0.7, c: 0.15, h: 250 };
    expect(adjustForTheme(mid, "dark")).toEqual(mid);
    expect(adjustForTheme(mid, "light")).toEqual(mid);
  });

  test("darkens a near-white brand for the light theme", () => {
    // Otherwise a white-on-white button disappears entirely.
    expect(adjustForTheme({ l: 0.97, c: 0.02, h: 90 }, "light").l).toBe(0.85);
  });

  test("preserves hue and chroma so it still reads as the same brand", () => {
    const navy = oklch("#0b3d91");
    const lifted = adjustForTheme(navy, "dark");
    expect(lifted.c).toBe(navy.c);
    expect(lifted.h).toBe(navy.h);
  });
});

describe("themeTokensCss", () => {
  test("emits nothing when the project configures nothing", () => {
    // The no-config admin must render byte-for-byte as it does today.
    expect(themeTokensCss({})).toBe("");
  });

  test("emits nothing for an accent that does not parse", () => {
    // Fail closed: a typo in the settings singleton leaves the default theme
    // standing rather than shipping a half-written token block.
    expect(themeTokensCss({ accent: "burgundy" })).toBe("");
  });

  test("re-points the four tokens that carry the brand", () => {
    const css = themeTokensCss({ accent: "#c0392b" });
    for (const token of [
      "--primary:",
      "--primary-foreground:",
      "--ring:",
      "--sidebar-primary:",
      "--sidebar-primary-foreground:",
      "--sidebar-ring:",
    ]) {
      expect(css).toContain(token);
    }
  });

  test("writes a :root block and a .dark block with different accents", () => {
    // The point of the dark block: the same brand at a lightness the dark
    // theme can actually show.
    const css = themeTokensCss({ accent: "#0b3d91" });
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
    expect(css).toContain("oklch(0.386 0.148 260.69)");
    expect(css).toContain("oklch(0.62 0.148 260.69)");
  });

  test("emits only the :root block when radius or density is set alone", () => {
    // No accent means no per-theme colour work, so there is nothing for the
    // `.dark` block to say.
    const css = themeTokensCss({ radius: "sharp", density: "comfortable" });
    expect(css).toContain("--radius: 0rem;");
    expect(css).toContain("--spacing: 0.28rem;");
    expect(css).not.toContain(".dark");
  });

  test("the radius presets map onto --radius", () => {
    expect(themeTokensCss({ radius: "sharp" })).toContain("--radius: 0rem;");
    // `soft` restates the kit's shipped value, so declaring the default is a
    // no-op rather than a surprise.
    expect(themeTokensCss({ radius: "soft" })).toContain("--radius: 0.625rem;");
    expect(themeTokensCss({ radius: "round" })).toContain("--radius: 1rem;");
  });

  test("compact density restates Tailwind's own spacing root", () => {
    // `compact` is what the admin renders today; setting it must change nothing.
    expect(themeTokensCss({ density: "compact" })).toContain("--spacing: 0.25rem;");
  });
});

describe("oklchToHex", () => {
  test("round-trips a hex brand colour", () => {
    // The map pin is derived from the token, so a lossy conversion would show a
    // subtly different colour beside every button painted from the same brand.
    for (const hex of ["#ff0000", "#c0392b", "#0b3d91", "#808080", "#ffffff", "#000000"]) {
      expect(oklchToHex(oklch(hex))).toBe(hex);
    }
  });

  test("clamps an out-of-gamut colour instead of emitting junk digits", () => {
    // A lightened, saturated accent can leave sRGB; a negative channel would
    // format as `#NaN`-ish garbage and paint the marker black.
    expect(oklchToHex({ l: 0.9, c: 0.4, h: 140 })).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("parseOklch", () => {
  test("reads the token form the kit writes", () => {
    expect(parseOklch("oklch(0.543 0.174 29.7)")).toEqual({ l: 0.543, c: 0.174, h: 29.7 });
  });

  test("reads the percentage form a browser may hand back", () => {
    // `getComputedStyle` is free to normalise the value it returns, so the
    // parser has to accept more shapes than the generator writes.
    expect(parseOklch("oklch(62.8% 0.258 29.23)")?.l).toBeCloseTo(0.628, 3);
  });

  test("tolerates surrounding whitespace", () => {
    expect(parseOklch("  oklch(0.5 0.1 200)  ")).toEqual({ l: 0.5, c: 0.1, h: 200 });
  });

  test("returns null for any other colour syntax", () => {
    // A project that overrode --primary with a hex or rgb() simply doesn't get
    // the derived surfaces — better than a wrong colour.
    for (const bad of ["#c0392b", "rgb(1 2 3)", "oklch()", "", "oklch(1 2)"]) {
      expect(parseOklch(bad)).toBeNull();
    }
  });
});

describe("accentColor", () => {
  test("reads the live --primary token as hex", () => {
    document.documentElement.style.setProperty("--primary", "oklch(0.543 0.174 29.7)");
    expect(accentColor()).toBe("#c0392b");
    document.documentElement.style.removeProperty("--primary");
  });

  test("returns undefined when the token is unset or not an oklch value", () => {
    // The caller keeps maplibre's own default pin rather than painting black.
    expect(accentColor()).toBeUndefined();
    document.documentElement.style.setProperty("--primary", "#c0392b");
    expect(accentColor()).toBeUndefined();
    document.documentElement.style.removeProperty("--primary");
  });
});
