import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input, Label } from "@voila/ui";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: "Email address" } };

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@voila.dev" />
    </div>
  ),
};

export const Disabled: Story = { args: { placeholder: "Disabled", disabled: true } };
