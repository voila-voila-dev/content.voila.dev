import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, DropdownMenu } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/DropdownMenu",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline">Open menu</Button>} />
      <DropdownMenu.Content>
        <DropdownMenu.Label>My account</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          Profile <DropdownMenu.Shortcut>⇧⌘P</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item>Billing</DropdownMenu.Item>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Log out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  ),
};
