import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Avatar",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar.Root>
        <Avatar.Image src="https://github.com/shadcn.png" alt="shadcn" />
        <Avatar.Fallback>CN</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root>
        <Avatar.Fallback>VL</Avatar.Fallback>
      </Avatar.Root>
    </div>
  ),
};
