import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea, Separator } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/ScrollArea",
};

export default meta;

const tags = Array.from({ length: 25 }).map((_, i) => `v1.${i}.0`);

export const Default: StoryObj = {
  render: () => (
    <ScrollArea.Root className="h-60 w-48 rounded-md border">
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium leading-none">Tags</h4>
        {tags.map((tag) => (
          <div key={tag}>
            <div className="text-sm">{tag}</div>
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    </ScrollArea.Root>
  ),
};
