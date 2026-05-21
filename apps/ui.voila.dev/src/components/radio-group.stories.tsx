import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label, RadioGroup } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/RadioGroup",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <RadioGroup.Root defaultValue="comfortable">
      <div className="flex items-center gap-2">
        <RadioGroup.Item id="r1" value="default" />
        <Label htmlFor="r1">Default</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroup.Item id="r2" value="comfortable" />
        <Label htmlFor="r2">Comfortable</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroup.Item id="r3" value="compact" />
        <Label htmlFor="r3">Compact</Label>
      </div>
    </RadioGroup.Root>
  ),
};
