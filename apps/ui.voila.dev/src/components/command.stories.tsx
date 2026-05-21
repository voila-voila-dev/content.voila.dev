import type { Meta, StoryObj } from "@storybook/react-vite";
import { Command } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Command",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Command.Root className="w-80 rounded-lg border shadow-md">
      <Command.Input placeholder="Type a command or search…" />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Suggestions">
          <Command.Item>Calendar</Command.Item>
          <Command.Item>Search emoji</Command.Item>
          <Command.Item>Calculator</Command.Item>
        </Command.Group>
        <Command.Separator />
        <Command.Group heading="Settings">
          <Command.Item>
            Profile <Command.Shortcut>⌘P</Command.Shortcut>
          </Command.Item>
          <Command.Item>
            Settings <Command.Shortcut>⌘S</Command.Shortcut>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Root>
  ),
};
