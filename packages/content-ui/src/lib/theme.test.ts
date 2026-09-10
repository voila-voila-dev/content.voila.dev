import { afterEach, describe, expect, test } from "bun:test";
import {
  applyTheme,
  resolvedTheme,
  setTheme,
  setThemeChoice,
  storedTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  themeChoice,
  themeInitScript,
  watchSystemTheme,
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

describe("themeChoice / setThemeChoice", () => {
  test("reads a stored light/dark pick, and 'system' when there is none", () => {
    expect(themeChoice()).toBe("system");
    setThemeChoice("light");
    expect(themeChoice()).toBe("light");
  });

  test("'system' is stored explicitly, so a later light pick can be undone", () => {
    // Clearing the key would work only until someone picked light or dark; the
    // menu needs a value it can round-trip back to "follow the OS".
    stubPrefersDark(true);
    setThemeChoice("light");
    setThemeChoice("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(themeChoice()).toBe("system");
    // …and the OS preference is what actually gets applied.
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("a light/dark pick applies that theme regardless of the OS", () => {
    stubPrefersDark(true);
    setThemeChoice("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(resolvedTheme()).toBe("light");
  });
});

describe("watchSystemTheme", () => {
  function stubMedia(): { fire: (matches: boolean) => void; listeners: number } {
    const state = { listeners: 0, handler: undefined as ((e: unknown) => void) | undefined };
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, handler: (e: unknown) => void) => {
        state.listeners += 1;
        state.handler = handler;
      },
      removeEventListener: () => {
        state.listeners -= 1;
      },
    })) as unknown as typeof window.matchMedia;
    return {
      get listeners() {
        return state.listeners;
      },
      fire: (matches: boolean) => {
        stubPrefersDark(matches);
        state.handler?.({});
      },
    };
  }

  test("follows an OS switch while the choice is 'system'", () => {
    // A page left open across the OS's scheduled dark switch should follow it —
    // `themeInitScript` only runs once, at load.
    const media = stubMedia();
    setThemeChoice("system");
    const stop = watchSystemTheme();
    media.fire(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    stop();
  });

  test("leaves an explicit pick alone, and unsubscribes", () => {
    const media = stubMedia();
    const stop = watchSystemTheme();
    setThemeChoice("light");
    media.fire(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    stop();
    expect(media.listeners).toBe(0);
  });
});
