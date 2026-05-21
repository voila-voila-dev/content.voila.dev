import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavigationMenu } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/NavigationMenu",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>Getting started</NavigationMenu.Trigger>
          <NavigationMenu.Content className="p-4 text-sm">
            <p className="font-medium">@voila/ui</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Cross-product design system for Voila.
            </p>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#" className="px-4 py-2 text-sm">
            Docs
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Viewport />
    </NavigationMenu.Root>
  ),
};
