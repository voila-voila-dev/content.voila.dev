// Theme handling for the admin. `@voila/ui` ships `.dark` token overrides keyed
// off a class on `<html>`; these helpers decide which theme applies — an
// explicit localStorage choice, else the OS `prefers-color-scheme` — and flip
// that class. `themeInitScript` is the same resolution logic as an inline-able
// string so hosts can apply the theme in `<head>` before first paint.

export type Theme = "light" | "dark";

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
 * Inline this in `<head>` (e.g. via `<script dangerouslySetInnerHTML>`) so the
 * theme is applied before the body paints — without it, a dark-mode visitor
 * sees a flash of the light theme on every load.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark)}catch(e){}})();`;
