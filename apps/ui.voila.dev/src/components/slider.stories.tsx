import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "@voila/ui";

const meta: Meta<typeof Slider> = {
  title: "Primitives/Slider",
  component: Slider,
};

export default meta;

export const Default: StoryObj<typeof Slider> = {
  render: () => (
    <div className="w-72">
      <Slider defaultValue={50} max={100} step={1} />
    </div>
  ),
};
