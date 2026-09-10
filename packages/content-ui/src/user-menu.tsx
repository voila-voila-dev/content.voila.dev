// UserMenu — the sidebar footer's account block: an avatar (initials from the
// name or email), the name + email, and a caret opening a menu with the theme
// choice, the keyboard-shortcut sheet and Sign out. This is the ONE place the
// admin switches theme — the page header used to carry a second toggle, which
// left two controls for one setting and no home for anything else.
// Presentational: the host passes the signed-in user and the sign-out handler;
// extra items slot in through `children`. Collapses to the avatar alone on the
// icon rail.

import {
  CaretUpDownIcon,
  DesktopIcon,
  KeyboardIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { Avatar } from "@voila.dev/ui/avatar";
import { Dialog } from "@voila.dev/ui/dialog";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import { Kbd } from "@voila.dev/ui/kbd";
import { Sidebar } from "@voila.dev/ui/sidebar";
import { getInitials } from "@voila.dev/ui/user-avatar";
import { type ReactNode, useEffect, useState } from "react";
import { setThemeChoice, type ThemeChoice, themeChoice, watchSystemTheme } from "./lib/theme";

/** One row of the keyboard-shortcut sheet. */
export interface ShortcutHint {
  /** The keys, already split (`["⌘", "K"]`) — rendered as separate caps. */
  readonly keys: ReadonlyArray<string>;
  readonly description: string;
}

/**
 * The shortcuts the admin actually binds today. Deliberately short: a sheet
 * that lists keys nothing listens for is worse than no sheet. ⌘K is bound in
 * the admin layout, ⌘B by the kit's `Sidebar.Provider`, and the arrow/enter/
 * escape behaviour comes from the command palette and dialog primitives.
 */
export const DEFAULT_SHORTCUTS: ReadonlyArray<ShortcutHint> = [
  { keys: ["⌘", "K"], description: "Open the command palette (search, jump, create)" },
  { keys: ["⌘", "B"], description: "Show or hide the sidebar" },
  { keys: ["↑", "↓"], description: "Move through command palette results" },
  { keys: ["↵"], description: "Open the highlighted result" },
  { keys: ["Esc"], description: "Close the palette or an open dialog" },
];

const THEME_OPTIONS: ReadonlyArray<{
  readonly value: ThemeChoice;
  readonly label: string;
  readonly Icon: typeof SunIcon;
}> = [
  { value: "system", label: "System", Icon: DesktopIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

export interface UserMenuProps {
  readonly name?: string | null;
  readonly email?: string | null;
  /** Avatar image URL. */
  readonly avatarUrl?: string;
  readonly onSignOut?: () => void;
  /** Rows for the "Keyboard shortcuts" sheet. Defaults to the admin's own. */
  readonly shortcuts?: ReadonlyArray<ShortcutHint>;
  /** Extra menu items rendered above Sign out (e.g. a profile link). */
  readonly children?: ReactNode;
}

/** Initials for the avatar fallback: from the name, else the email's local part. */
export function userInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0]?.replace(/[._-]+/g, " ") || "?";
  return getInitials(source) || "?";
}

export function UserMenu({
  name,
  email,
  avatarUrl,
  onSignOut,
  shortcuts = DEFAULT_SHORTCUTS,
  children,
}: UserMenuProps): ReactNode {
  const primary = name?.trim() || email || "Signed in";
  const secondary = name?.trim() && email ? email : undefined;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // The stored choice only exists in the browser, and the server renders no
  // theme at all (see `themeInitScript`), so read it after mount — marking an
  // option active during SSR would be a hydration mismatch.
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setChoice(themeChoice());
    return watchSystemTheme();
  }, []);

  function pickTheme(next: ThemeChoice): void {
    setThemeChoice(next);
    setChoice(next);
  }

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={
              <Sidebar.MenuButton
                size="lg"
                tooltip={primary}
                data-slot="user-menu"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar.Root size="sm" className="rounded-md">
              {avatarUrl ? <Avatar.Image src={avatarUrl} alt="" /> : null}
              <Avatar.Fallback className="rounded-md text-xs">
                {userInitials(name, email)}
              </Avatar.Fallback>
            </Avatar.Root>
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-medium text-sm">{primary}</span>
              {secondary ? (
                <span className="truncate text-muted-foreground text-xs">{secondary}</span>
              ) : null}
            </span>
            <CaretUpDownIcon className="ml-auto" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="top" align="start" className="min-w-56">
            <DropdownMenu.Label className="truncate font-normal text-muted-foreground text-xs">
              {email ?? primary}
            </DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Label className="font-normal text-muted-foreground text-xs">
              Theme
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={choice ?? "system"}
              onValueChange={(value) => pickTheme(value as ThemeChoice)}
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  // Stay open after a pick so the user can see the theme change
                  // and try another without reopening the menu three times.
                  closeOnClick={false}
                >
                  <Icon aria-hidden />
                  {label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={() => setShortcutsOpen(true)}>
              <KeyboardIcon aria-hidden />
              Keyboard shortcuts
            </DropdownMenu.Item>
            {children ? (
              <>
                <DropdownMenu.Separator />
                {children}
              </>
            ) : null}
            {onSignOut ? (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={onSignOut}>
                  <SignOutIcon aria-hidden />
                  Sign out
                </DropdownMenu.Item>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        {/* Outside the menu content: a dialog nested in it would unmount with
            the menu the moment the item that opens it is clicked. */}
        <Dialog.Root open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <Dialog.Content className="max-w-md">
            <Dialog.Header>
              <Dialog.Title>Keyboard shortcuts</Dialog.Title>
              <Dialog.Description>Everything the admin listens for.</Dialog.Description>
            </Dialog.Header>
            <dl data-slot="shortcut-list" className="grid gap-2 text-sm">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.description} className="flex items-center justify-between gap-4">
                  <dt className="min-w-0 text-muted-foreground">{shortcut.description}</dt>
                  <dd className="shrink-0">
                    <Kbd.Group>
                      {shortcut.keys.map((cap) => (
                        <Kbd.Root key={cap}>{cap}</Kbd.Root>
                      ))}
                    </Kbd.Group>
                  </dd>
                </div>
              ))}
            </dl>
          </Dialog.Content>
        </Dialog.Root>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}
