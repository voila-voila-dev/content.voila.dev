import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label, Textarea } from "@voila/ui";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = { args: { placeholder: "Type your message here." } };

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Type your message here." />
    </div>
  ),
};
