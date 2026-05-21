import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar } from "@voila/ui";
import { GearIcon, HouseIcon, UserIcon } from "@voila/ui/icons";

const meta: Meta = {
  title: "Primitives/Sidebar",
};

export default meta;

const items = [
  { title: "Home", icon: HouseIcon },
  { title: "Profile", icon: UserIcon },
  { title: "Settings", icon: GearIcon },
];

export const Default: StoryObj = {
  render: () => (
    <Sidebar.Provider>
      <div className="flex h-[420px] w-[640px] overflow-hidden rounded-lg border bg-sidebar text-sidebar-foreground">
        <Sidebar.Root>
          <Sidebar.Header className="px-3 py-2 text-sm font-semibold">@voila/ui</Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group.Root>
              <Sidebar.Group.Label>Application</Sidebar.Group.Label>
              <Sidebar.Group.Content>
                <Sidebar.Menu.Root>
                  {items.map((item) => (
                    <Sidebar.Menu.Item key={item.title}>
                      <Sidebar.Menu.Button>
                        <item.icon />
                        <span>{item.title}</span>
                      </Sidebar.Menu.Button>
                    </Sidebar.Menu.Item>
                  ))}
                </Sidebar.Menu.Root>
              </Sidebar.Group.Content>
            </Sidebar.Group.Root>
          </Sidebar.Content>
        </Sidebar.Root>
        <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Sidebar.Trigger className="absolute left-3 top-3" />
          Content area
        </main>
      </div>
    </Sidebar.Provider>
  ),
};
