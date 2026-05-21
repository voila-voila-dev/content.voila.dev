import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToggleGroup } from "@voila/ui";
import { TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon } from "@voila/ui/icons";

const meta: Meta = {
  title: "Primitives/ToggleGroup",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <ToggleGroup.Root defaultValue={["left"]}>
      <ToggleGroup.Item value="left" aria-label="Align left">
        <TextAlignLeftIcon />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="center" aria-label="Align center">
        <TextAlignCenterIcon />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="right" aria-label="Align right">
        <TextAlignRightIcon />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  ),
};
