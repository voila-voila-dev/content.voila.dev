// UserMenu — the sidebar footer's account block: an avatar (initials from the
// name or email), the name + email, and a caret opening a menu with the theme
// switch and Sign out. Presentational: the host passes the signed-in user and
// the sign-out handler; extra items slot in through `children`. Collapses to
// the avatar alone on the icon rail.

import { CaretUpDownIcon, MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import { Avatar } from "@voila.dev/ui/avatar";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import { Sidebar } from "@voila.dev/ui/sidebar";
import { getInitials } from "@voila.dev/ui/user-avatar";
import type { ReactNode } from "react";
import { setTheme } from "./lib/theme";

export interface UserMenuProps {
  readonly name?: string | null;
  readonly email?: string | null;
  /** Avatar image URL. */
  readonly avatarUrl?: string;
  readonly onSignOut?: () => void;
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
  children,
}: UserMenuProps): ReactNode {
  const primary = name?.trim() || email || "Signed in";
  const secondary = name?.trim() && email ? email : undefined;
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
            <DropdownMenu.Item onClick={() => setTheme("light")}>
              <SunIcon aria-hidden />
              Light theme
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => setTheme("dark")}>
              <MoonIcon aria-hidden />
              Dark theme
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
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}
