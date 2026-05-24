import { Link, useLocation } from "@tanstack/react-router";
import { Avatar, DropdownMenu, Separator, Sidebar as VoilaSidebar } from "@voila/ui";
import { DatabaseIcon, FilesIcon, GearIcon, HouseIcon, SignOutIcon } from "@voila/ui/icons";
import type { ComponentType, ReactNode } from "react";
import type { ResolvedContentConfig } from "../types.ts";

type SidebarUser = {
  name: string;
  email: string;
  image: string | null;
} | null;

type NavigationItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

function buildNavigation(config: ResolvedContentConfig): NavigationGroup[] {
  const groups: NavigationGroup[] = [];

  const collections = Object.values(config.collections);
  if (collections.length > 0) {
    groups.push({
      label: "Collections",
      items: collections.map((c) => ({
        label: c.label ?? c.slug,
        href: `${config.mount.admin}/collections/${c.slug}/`,
        icon: c.icon ?? FilesIcon,
      })),
    });
  }

  const singletons = Object.values(config.singletons);
  if (singletons.length > 0) {
    groups.push({
      label: "Singletons",
      items: singletons.map((s) => ({
        label: s.label ?? s.slug,
        href: `${config.mount.admin}/singletons/${s.slug}`,
        icon: s.icon ?? DatabaseIcon,
      })),
    });
  }

  return groups;
}

export interface AdminSidebarProps {
  config: ResolvedContentConfig;
  user?: SidebarUser;
  onSignOut?: () => void;
  children: ReactNode;
}

export function AdminSidebar({ config, user = null, onSignOut, children }: AdminSidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigation = buildNavigation(config);
  const brandName = config.branding.name ?? "Voila";
  const Logo = config.branding.logo;
  const LogoDark = config.branding.logoDark;
  const userInitial = user?.name.charAt(0).toUpperCase() ?? "?";

  return (
    <VoilaSidebar.Provider>
      <VoilaSidebar.Root variant="inset">
        <VoilaSidebar.Header>
          <VoilaSidebar.Menu.Root>
            <VoilaSidebar.Menu.Item>
              <VoilaSidebar.Menu.Button
                size="lg"
                render={
                  // Trailing slash targets the admin index route explicitly so TanStack
                  // doesn't ambiguously match. The Link types are built per-consumer-app
                  // and can't see our generic `mount.admin` template, so cast through.
                  <Link
                    to={`${config.mount.admin}/` as unknown as "/admin"}
                    aria-label="Go to admin home"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  {Logo && LogoDark && <Logo className="size-4 dark:hidden" />}
                  {Logo && LogoDark && <LogoDark className="hidden size-4 dark:block" />}
                  {Logo && !LogoDark && <Logo className="size-4" />}
                  {!Logo && !LogoDark && <HouseIcon className="size-4" />}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{brandName}</span>
                  <span className="truncate text-xs">Admin</span>
                </div>
              </VoilaSidebar.Menu.Button>
            </VoilaSidebar.Menu.Item>
          </VoilaSidebar.Menu.Root>
        </VoilaSidebar.Header>

        <VoilaSidebar.Content>
          {navigation.map((group) => (
            <VoilaSidebar.Group.Root key={group.label}>
              <VoilaSidebar.Group.Label>{group.label}</VoilaSidebar.Group.Label>
              <VoilaSidebar.Group.Content>
                <VoilaSidebar.Menu.Root>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <VoilaSidebar.Menu.Item key={item.href}>
                        <VoilaSidebar.Menu.Button
                          isActive={isActive}
                          render={
                            <Link to={item.href}>
                              <Icon className="size-4" />
                              <span>{item.label}</span>
                            </Link>
                          }
                        />
                      </VoilaSidebar.Menu.Item>
                    );
                  })}
                </VoilaSidebar.Menu.Root>
              </VoilaSidebar.Group.Content>
            </VoilaSidebar.Group.Root>
          ))}
        </VoilaSidebar.Content>

        <VoilaSidebar.Footer>
          <VoilaSidebar.Menu.Root>
            <VoilaSidebar.Menu.Item>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  render={
                    <VoilaSidebar.Menu.Button size="lg">
                      <Avatar.Root className="size-8">
                        {user?.image ? <Avatar.Image src={user.image} alt={user.name} /> : null}
                        <Avatar.Fallback>{userInitial}</Avatar.Fallback>
                      </Avatar.Root>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{user?.name ?? "Guest"}</span>
                        <span className="truncate text-xs">{user?.email ?? ""}</span>
                      </div>
                    </VoilaSidebar.Menu.Button>
                  }
                />
                <DropdownMenu.Content align="start" className="w-48">
                  <DropdownMenu.Item disabled>
                    <GearIcon className="size-4" />
                    Settings
                  </DropdownMenu.Item>
                  {onSignOut ? (
                    <DropdownMenu.Item onClick={onSignOut}>
                      <SignOutIcon className="size-4" />
                      Sign out
                    </DropdownMenu.Item>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </VoilaSidebar.Menu.Item>
          </VoilaSidebar.Menu.Root>
        </VoilaSidebar.Footer>
      </VoilaSidebar.Root>

      <VoilaSidebar.Inset className="flex flex-col overflow-hidden md:h-[calc(100dvh-1rem)]">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <VoilaSidebar.Trigger />
            <Separator orientation="vertical" className="mr-2 min-h-6 w-px" />
            <span className="text-muted-foreground text-sm">{brandName}</span>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </VoilaSidebar.Inset>
    </VoilaSidebar.Provider>
  );
}
