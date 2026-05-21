import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Collapsible } from "@voila/ui";
import { CaretDownIcon } from "@voila/ui/icons";

const meta: Meta = {
  title: "Primitives/Collapsible",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Collapsible.Root className="w-80 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">@voila/ui has 46 primitives</h4>
        <Collapsible.Trigger
          render={
            <Button variant="ghost" size="sm">
              <CaretDownIcon /> Toggle
            </Button>
          }
        />
      </div>
      <Collapsible.Content className="space-y-2 rounded-md border px-4 py-3 text-sm">
        <div>@voila/ui/button</div>
        <div>@voila/ui/card</div>
        <div>@voila/ui/dialog</div>
      </Collapsible.Content>
    </Collapsible.Root>
  ),
};
