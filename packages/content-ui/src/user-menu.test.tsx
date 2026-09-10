import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Sidebar } from "@voila.dev/ui/sidebar";
import type { ReactNode } from "react";
import { THEME_STORAGE_KEY } from "./lib/theme";
import { UserMenu, userInitials } from "./user-menu";

const realMatchMedia = window.matchMedia;

function stubPrefersDark(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

// The menu button is a `Sidebar.MenuButton`, which needs the kit's provider.
function renderMenu(node: ReactNode) {
  return render(<Sidebar.Provider>{node}</Sidebar.Provider>);
}

async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /alex@example.com/ }));
  await screen.findByRole("menuitemradio", { name: "System" });
}

describe("userInitials", () => {
  test("falls back to the email's local part when there is no name", () => {
    expect(userInitials("Ada Lovelace")).toBe("AL");
    expect(userInitials(null, "ada.lovelace@example.com")).toBe("AL");
    expect(userInitials()).toBe("?");
  });
});

describe("UserMenu theme choice", () => {
  test("offers System, Light and Dark — the OS default is a real, pickable option", async () => {
    stubPrefersDark(false);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    for (const label of ["System", "Light", "Dark"]) {
      expect(screen.getByRole("menuitemradio", { name: label })).toBeDefined();
    }
  });

  test("marks the stored choice as the active one", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    stubPrefersDark(false);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    expect(screen.getByRole("menuitemradio", { name: "Dark" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "System" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  test("defaults to System when nothing was ever picked", async () => {
    stubPrefersDark(true);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    expect(screen.getByRole("menuitemradio", { name: "System" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  test("picking Dark applies and persists it", async () => {
    stubPrefersDark(false);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("picking System hands control back to the OS preference", async () => {
    // The old two-way toggle had no way back: once you clicked Light, the admin
    // stayed light even when the OS went dark. "system" is stored explicitly.
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    stubPrefersDark(true);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "System" }));
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});

describe("UserMenu shortcuts", () => {
  test("lists the shortcuts the admin really binds", async () => {
    stubPrefersDark(false);
    renderMenu(<UserMenu email="alex@example.com" />);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Keyboard shortcuts/ }));
    const dialog = await screen.findByRole("dialog");
    // ⌘K is bound in the admin layout, ⌘B by the kit's sidebar provider.
    expect(dialog.textContent).toContain("command palette");
    expect(dialog.textContent).toContain("sidebar");
    expect(dialog.textContent).toContain("⌘");
  });

  test("a host can replace the list (an embedder binds its own keys)", async () => {
    stubPrefersDark(false);
    renderMenu(
      <UserMenu
        email="alex@example.com"
        shortcuts={[{ keys: ["⌘", "S"], description: "Save the draft" }]}
      />,
    );
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Keyboard shortcuts/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Save the draft");
    expect(dialog.textContent).not.toContain("command palette");
  });
});

describe("UserMenu account", () => {
  test("signs out through the host's handler", async () => {
    stubPrefersDark(false);
    const onSignOut = mock();
    renderMenu(<UserMenu email="alex@example.com" onSignOut={onSignOut} />);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Sign out/ }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("renders extra items a host slots in", async () => {
    stubPrefersDark(false);
    renderMenu(
      <UserMenu email="alex@example.com">
        <button type="button" role="menuitem">
          Profile
        </button>
      </UserMenu>,
    );
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeDefined();
  });
});
