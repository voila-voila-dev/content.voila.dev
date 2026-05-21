import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Toaster, toast } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Sonner",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <>
      <Toaster />
      <Button
        variant="outline"
        onClick={() =>
          toast("Event created", {
            description: "Sunday, December 03, 2023 at 9:00 AM",
            action: { label: "Undo", onClick: () => {} },
          })
        }
      >
        Show toast
      </Button>
    </>
  ),
};
