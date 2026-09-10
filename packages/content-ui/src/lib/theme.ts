// Theme handling for the admin. `@voila.dev/ui` ships `.dark` token overrides keyed
// off a class on `<html>`; these helpers decide which theme applies — an
// explicit localStorage choice, else the OS `prefers-color-scheme` — and flip
// that class. `themeInitScript` is the same resolution logic as an inline-able
// string so hosts can apply the theme in `<head>` before first paint.

export type Theme = "light" | "dark";

/**
 * What the user picked, as opposed to what is on screen. "system" is a real,
 * persisted choice — someone who has ever clicked Light must be able to get
 * back to following the OS, and an absent key can't express that intent.
 */
export type ThemeChoice = Theme | "system";

/** localStorage key holding an explicit theme choice. */
export const THEME_STORAGE_KEY = "voila-theme";

/** The explicit theme stored by the toggle, if any. */
export function storedTheme(): Theme | undefined {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : undefined;
}

/** The OS-level `prefers-color-scheme` preference. */
export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The theme in effect: the stored choice, else the OS preference. */
export function resolvedTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** Set or clear the `dark` class on `<html>`. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Persist an explicit theme choice and apply it. */
export function setTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * The stored choice as the picker shows it: a light/dark pick, else "system".
 * A stored `"system"` and a missing key mean the same thing at read time — the
 * value is written so the OS default survives a later light/dark pick, and
 * `themeInitScript` treats any non-`light`/`dark` value as "follow the OS".
 */
export function themeChoice(): ThemeChoice {
  return storedTheme() ?? "system";
}

/** Persist a three-way choice and apply whichever theme it resolves to. */
export function setThemeChoice(choice: ThemeChoice): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  applyTheme(choice === "system" ? systemTheme() : choice);
}

/**
 * Follow OS changes while the choice is "system". Returns an unsubscribe. A
 * page left open across a scheduled light→dark switch should follow it, which
 * the one-shot `themeInitScript` can't do on its own.
 */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => {
    if (themeChoice() === "system") applyTheme(systemTheme());
  };
  media.addEventListener?.("change", listener);
  return () => media.removeEventListener?.("change", listener);
}

/**
 * Inline this in `<head>` (e.g. via `<script dangerouslySetInnerHTML>`) so the
 * theme is applied before the body paints — without it, a dark-mode visitor
 * sees a flash of the light theme on every load.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark)}catch(e){}})();`;
