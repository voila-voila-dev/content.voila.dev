import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "@voila/ui";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-72">
      <p className="text-sm">Above</p>
      <Separator className="my-4" />
      <p className="text-sm text-muted-foreground">Below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-6 items-center gap-3 text-sm">
      <span>Left</span>
      <Separator orientation="vertical" />
      <span>Middle</span>
      <Separator orientation="vertical" />
      <span>Right</span>
    </div>
  ),
};
