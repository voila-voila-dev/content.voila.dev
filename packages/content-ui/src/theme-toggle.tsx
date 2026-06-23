// ThemeToggle — a header-bar button that switches the admin between light and
// dark mode. The icon pair is CSS-swapped via the `dark:` variant so the
// server-rendered markup is theme-agnostic (no hydration mismatch); clicking
// stores the opposite of the currently resolved theme in localStorage and
// flips the `dark` class on `<html>`.

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Button } from "@voila/ui/button";
import type { ReactNode } from "react";
import { resolvedTheme, setTheme } from "./lib/theme";

export function ThemeToggle(): ReactNode {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme() === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
