import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "@voila/ui";

const meta: Meta<typeof Progress> = {
  title: "Primitives/Progress",
  component: Progress,
};

export default meta;

export const Default: StoryObj<typeof Progress> = {
  render: () => (
    <div className="w-72">
      <Progress value={66} />
    </div>
  ),
};
