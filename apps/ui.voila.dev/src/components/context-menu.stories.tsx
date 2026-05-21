import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextMenu } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/ContextMenu",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="flex h-40 w-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Right-click here
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item>Back</ContextMenu.Item>
        <ContextMenu.Item>Forward</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>Reload</ContextMenu.Item>
        <ContextMenu.Item>Save as…</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  ),
};
