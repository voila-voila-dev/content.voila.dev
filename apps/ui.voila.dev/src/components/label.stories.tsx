import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "@voila/ui";

const meta: Meta<typeof Label> = {
  title: "Primitives/Label",
  component: Label,
  args: { children: "Email" },
};

export default meta;
export const Default: StoryObj<typeof Label> = {};
