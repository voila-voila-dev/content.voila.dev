import { afterEach, describe, expect, test } from "bun:test";
import {
  applyTheme,
  resolvedTheme,
  setTheme,
  storedTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "./theme";

const realMatchMedia = window.matchMedia;

function stubPrefersDark(matches: boolean): void {
  window.matchMedia = ((query: string) => ({ matches, media: query })) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("storedTheme", () => {
  test("returns the stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(storedTheme()).toBe("dark");
  });

  test("ignores missing or junk values", () => {
    expect(storedTheme()).toBeUndefined();
    window.localStorage.setItem(THEME_STORAGE_KEY, "blue");
    expect(storedTheme()).toBeUndefined();
  });
});

describe("systemTheme", () => {
  test("follows prefers-color-scheme", () => {
    stubPrefersDark(true);
    expect(systemTheme()).toBe("dark");
    stubPrefersDark(false);
    expect(systemTheme()).toBe("light");
  });
});

describe("resolvedTheme", () => {
  test("prefers the stored choice over the OS preference", () => {
    stubPrefersDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(resolvedTheme()).toBe("light");
  });

  test("falls back to the OS preference", () => {
    stubPrefersDark(true);
    expect(resolvedTheme()).toBe("dark");
  });
});

describe("applyTheme / setTheme", () => {
  test("applyTheme toggles the dark class on <html>", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("setTheme persists the choice and applies it", () => {
    setTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

describe("themeInitScript", () => {
  function runScript(): void {
    new Function(themeInitScript)();
  }

  test("applies a stored dark theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    stubPrefersDark(false);
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("falls back to prefers-color-scheme when nothing is stored", () => {
    stubPrefersDark(true);
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("a stored light theme overrides a dark OS preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    stubPrefersDark(true);
    document.documentElement.classList.add("dark");
    runScript();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
