import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Select",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Select.Root defaultValue="apple">
      <Select.Trigger className="w-48">
        <Select.Value>{(value) => value ?? "Select a fruit"}</Select.Value>
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="banana">Banana</Select.Item>
        <Select.Item value="blueberry">Blueberry</Select.Item>
        <Select.Separator />
        <Select.Item value="grape">Grape</Select.Item>
      </Select.Content>
    </Select.Root>
  ),
};
