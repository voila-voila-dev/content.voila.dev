import type { Meta, StoryObj } from "@storybook/react-vite";
import { AspectRatio } from "@voila/ui";

const meta: Meta<typeof AspectRatio> = {
  title: "Primitives/AspectRatio",
  component: AspectRatio,
};

export default meta;

export const Default: StoryObj<typeof AspectRatio> = {
  render: () => (
    <div className="w-72">
      <AspectRatio ratio={16 / 9} className="bg-muted rounded-md flex items-center justify-center">
        <span className="text-sm text-muted-foreground">16:9</span>
      </AspectRatio>
    </div>
  ),
};
