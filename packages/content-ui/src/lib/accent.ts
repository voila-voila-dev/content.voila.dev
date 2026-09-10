// Brand accent → theme tokens.
//
// The admin's palette is the `@voila.dev/ui` token contract, and every token in it
// is `oklch(L C H)`. A project, though, stores its brand colour the way a
// designer hands it over: a hex string in a `fields.color()`. This module is the
// bridge — a dependency-free hex → OKLCH conversion plus the small amount of
// colour *judgement* that keeps a brand-tinted admin legible:
//
//   · the label on a coloured button is picked by luminance, not assumed white
//     (a lemon-yellow brand needs black text, a navy one needs white);
//   · the same brand is nudged into a usable lightness band per theme, because a
//     colour chosen to sit on white paper is often invisible on the dark
//     theme's near-black ground (and vice versa).
//
// Everything here is pure and string-in/string-out so the result can be inlined
// into the SSR'd document `<head>` — the tokens have to be in the first byte of
// HTML, or the admin paints unbranded and then flips.

/** A colour in the OKLCH space the kit's tokens are written in. */
export interface Oklch {
  /** Perceptual lightness, 0 (black) → 1 (white). */
  readonly l: number;
  /** Chroma (colourfulness); 0 is grey. */
  readonly c: number;
  /** Hue angle in degrees, 0–360. */
  readonly h: number;
}

/** Corner-radius preset; `soft` is the kit's shipped `--radius`. */
export type ThemeRadius = "sharp" | "soft" | "round";

/** Spacing-scale preset; `compact` is what the admin renders today. */
export type ThemeDensity = "compact" | "comfortable";

export interface ThemeTokensOptions {
  /** Brand colour as hex (`#c0392b`, `c0392b`, `#C39`, with or without alpha). */
  readonly accent?: string;
  readonly radius?: ThemeRadius;
  readonly density?: ThemeDensity;
}

/** `--radius` per preset. `soft` repeats the kit's default on purpose, so a
 *  project can state the default explicitly and get exactly today's look. */
const RADIUS_TOKENS: Record<ThemeRadius, string> = {
  sharp: "0rem",
  soft: "0.625rem",
  round: "1rem",
};

/** Tailwind v4's spacing scale root — every `p-*`/`gap-*` utility is
 *  `calc(var(--spacing) * n)`, so this one token moves the whole admin's
 *  breathing room coherently instead of a per-component density prop. */
const DENSITY_TOKENS: Record<ThemeDensity, string> = {
  compact: "0.25rem",
  comfortable: "0.28rem",
};

/** Lightness floor/ceiling for the accent on the light theme. Only the ceiling
 *  really bites: a near-white brand fills a button with white on white. */
const LIGHT_RANGE = { min: 0.2, max: 0.85 } as const;

/** …and on the dark theme, where the floor is the one that matters — a dark
 *  navy brand on a 0.145 ground is a button-shaped hole. */
const DARK_RANGE = { min: 0.62, max: 0.92 } as const;

/** WCAG relative luminance at which white and black text are equally legible
 *  (the crossover of the two contrast ratios against a mid tone). */
const CONTRAST_CROSSOVER = 0.179;

/** The kit's own foreground pair, reused so brand-tinted surfaces put the same
 *  ink on the page as everything else. */
const INK_DARK: Oklch = { l: 0.145, c: 0, h: 0 };
const INK_LIGHT: Oklch = { l: 1, c: 0, h: 0 };

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Expand a 3/4-digit shorthand (`#c39`) to its 6/8-digit form. */
function expandShorthand(hex: string): string {
  return hex
    .split("")
    .map((char) => char + char)
    .join("");
}

/**
 * Parse a hex colour to sRGB in 0–1. Accepts 3, 4, 6 and 8 digits, with or
 * without the leading `#`, in either case; any alpha is parsed and discarded
 * (a token that fades the brand would break contrast against both grounds).
 * Returns `null` for anything else — the caller must treat a bad value as "no
 * brand colour" rather than paint half a token block.
 */
export function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(raw)) return null;
  const digits = raw.length === 3 || raw.length === 4 ? expandShorthand(raw) : raw;
  if (digits.length !== 6 && digits.length !== 8) return null;
  return {
    r: Number.parseInt(digits.slice(0, 2), 16) / 255,
    g: Number.parseInt(digits.slice(2, 4), 16) / 255,
    b: Number.parseInt(digits.slice(4, 6), 16) / 255,
  };
}

/** sRGB → linear-light, the gamma decode both OKLCH and WCAG luminance need. */
function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance from linear-light sRGB. */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Convert a hex colour to OKLCH (Björn Ottosson's Oklab, then Lab → LCh).
 * Returns `null` when the hex doesn't parse.
 *
 * Values are rounded to the precision the kit's own theme files use — three
 * decimals for lightness/chroma, two for hue — so a generated token block is
 * diff-readable next to the hand-written ones.
 */
export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  if (rgb === null) return null;

  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(a * a + bb * bb);
  // Below this, the rounded chroma is 0 and the hue is numerical noise — pin it
  // to 0 so grey brands round-trip to a clean `oklch(L 0 0)`.
  const hue = chroma < 0.0005 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;

  return { l: round(lightness, 3), c: round(chroma, 3), h: round(hue, 2) };
}

/** Render an {@link Oklch} as the CSS function the kit's tokens use. */
export function formatOklch(color: Oklch): string {
  return `oklch(${color.l} ${color.c} ${color.h})`;
}

/**
 * WCAG relative luminance of an OKLCH colour (Oklab → linear sRGB, then the
 * usual weighted sum). The accent is adjusted in OKLCH but the contrast rule
 * that decides the ink is defined on sRGB luminance, so this inverts the
 * conversion rather than eyeballing a threshold on `l` — the same round trip
 * the tests pin against red's exact 0.2126.
 */
export function oklchLuminance(color: Oklch): number {
  const linear = oklchToLinearRgb(color);
  // Out-of-gamut accents can push a channel past the ends; clamping keeps the
  // luminance inside 0–1 so the ink decision stays sane for any input.
  return clamp(luminance(linear.r, linear.g, linear.b), 0, 1);
}

/** OKLCH → linear-light sRGB (Ottosson's inverse matrices). Channels may fall
 *  outside 0–1 for colours sRGB can't show; callers clamp. */
function oklchToLinearRgb(color: Oklch): Rgb {
  const hueRadians = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hueRadians);
  const b = color.c * Math.sin(hueRadians);

  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/** Linear-light → sRGB byte, gamma-encoded and clamped into the gamut. */
function encodeChannel(channel: number): string {
  const clamped = clamp(channel, 0, 1);
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(srgb * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * OKLCH → `#rrggbb`.
 *
 * The tokens are the source of truth, but a couple of surfaces can't read a CSS
 * variable: maplibre paints its default marker by writing a colour *string* into
 * an SVG. Handing those a hex keeps the brand pin working in browsers whose SVG
 * presentation attributes don't yet understand `oklch()`, where an unparseable
 * colour silently renders black.
 */
export function oklchToHex(color: Oklch): string {
  const linear = oklchToLinearRgb(color);
  return `#${encodeChannel(linear.r)}${encodeChannel(linear.g)}${encodeChannel(linear.b)}`;
}

/** Parse the `oklch(L C H)` form the kit's tokens are written in (the shape
 *  `getComputedStyle` hands back for `--primary`). Returns `null` for any other
 *  colour syntax — a project that overrode the token with `#hex` or a legacy
 *  `rgb()` just doesn't get the derived surfaces. */
export function parseOklch(value: string): Oklch | null {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*\)$/i.exec(value.trim());
  if (match === null) return null;
  const percent = (raw: string, full: number) =>
    raw.endsWith("%") ? (Number.parseFloat(raw) / 100) * full : Number.parseFloat(raw);
  const l = percent(match[1] as string, 1);
  const c = percent(match[2] as string, 0.4);
  const h = Number.parseFloat(match[3] as string);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null;
  return { l, c, h };
}

/**
 * The accent as a hex string, read from the live `--primary` token — for the
 * handful of surfaces that take a JS colour rather than CSS (the map's markers).
 * Returns `undefined` off-document, or when the token isn't an `oklch()` value,
 * so the caller keeps its library default instead of painting something wrong.
 */
export function accentColor(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const token = getComputedStyle(document.documentElement).getPropertyValue("--primary");
  const parsed = token === "" ? null : parseOklch(token);
  return parsed === null ? undefined : oklchToHex(parsed);
}

/**
 * The ink to put ON the accent: near-black for a light brand, near-white for a
 * dark one, decided by WCAG relative luminance. Assuming white — the kit's
 * default `--primary-foreground` — turns a yellow or lime brand's buttons into
 * unreadable labels, which is the one way a "make it yours" feature can make a
 * product objectively worse.
 */
export function contrastForeground(color: Oklch): Oklch {
  return oklchLuminance(color) > CONTRAST_CROSSOVER ? INK_DARK : INK_LIGHT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pull an accent into the lightness band a theme can actually show it in,
 * keeping hue and chroma so it still reads as the same brand. A brand picked
 * against white paper is routinely too dark for the dark theme's near-black
 * ground; lifting lightness is what keeps the active nav item visible instead of
 * disappearing into the sidebar.
 */
export function adjustForTheme(color: Oklch, theme: "light" | "dark"): Oklch {
  const range = theme === "dark" ? DARK_RANGE : LIGHT_RANGE;
  return { ...color, l: round(clamp(color.l, range.min, range.max), 3) };
}

/** The token block for one theme, as `--name: value;` declarations. The ink is
 *  picked from the *adjusted* accent, not the raw one — the dark theme's
 *  lightened variant can flip which of black/white wins. */
function accentDeclarations(accent: Oklch, theme: "light" | "dark"): string[] {
  const adjusted = adjustForTheme(accent, theme);
  const primary = formatOklch(adjusted);
  const foreground = formatOklch(contrastForeground(adjusted));
  return [
    // `--primary` carries the default button, the active nav item and the
    // sidebar's selected row; `--ring` carries every focus outline. Those four
    // are the whole of "the admin looks like our brand".
    `--primary: ${primary};`,
    `--primary-foreground: ${foreground};`,
    `--ring: ${primary};`,
    `--sidebar-primary: ${primary};`,
    `--sidebar-primary-foreground: ${foreground};`,
    `--sidebar-ring: ${primary};`,
  ];
}

function block(selector: string, declarations: readonly string[]): string {
  if (declarations.length === 0) return "";
  return `${selector} {\n  ${declarations.join("\n  ")}\n}`;
}

/**
 * Build the CSS that re-points the admin's tokens at a project's own
 * presentation: its brand accent (per theme, with a contrast-checked
 * foreground), corner radius and density.
 *
 * Returns `""` when there is nothing to say — no options, or an accent that
 * doesn't parse — so a project that configures nothing emits no style tag at
 * all and renders exactly as it does today.
 *
 * The result is meant to be inlined in `<head>` (see
 * `@voila/content-admin`'s `brandingHead`). Every value is machine-generated
 * from a validated hex or a fixed preset, so nothing user-typed reaches the
 * stylesheet verbatim.
 */
export function themeTokensCss(options: ThemeTokensOptions): string {
  const accent = options.accent === undefined ? null : hexToOklch(options.accent);

  const root: string[] = [];
  if (accent !== null) root.push(...accentDeclarations(accent, "light"));
  if (options.radius !== undefined) root.push(`--radius: ${RADIUS_TOKENS[options.radius]};`);
  if (options.density !== undefined) root.push(`--spacing: ${DENSITY_TOKENS[options.density]};`);

  const dark = accent !== null ? accentDeclarations(accent, "dark") : [];

  return [block(":root", root), block(".dark", dark)].filter((part) => part !== "").join("\n");
}
