import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Input, Label, Popover } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Popover",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline">Dimensions</Button>} />
      <Popover.Content>
        <div className="grid gap-2">
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="width">Width</Label>
            <Input id="width" defaultValue="100%" className="col-span-2 h-8" />
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="height">Height</Label>
            <Input id="height" defaultValue="25px" className="col-span-2 h-8" />
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  ),
};
