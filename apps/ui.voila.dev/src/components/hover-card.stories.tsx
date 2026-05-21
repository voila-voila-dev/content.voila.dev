import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, HoverCard } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/HoverCard",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <HoverCard.Root>
      <HoverCard.Trigger render={<Button variant="link">@voila</Button>} />
      <HoverCard.Content>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">@voila</h4>
          <p className="text-sm text-muted-foreground">A drop-in CMS for any Voila product.</p>
        </div>
      </HoverCard.Content>
    </HoverCard.Root>
  ),
};
