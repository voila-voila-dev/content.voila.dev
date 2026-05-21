import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Input, Label, Sheet } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Sheet",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline">Open sheet</Button>} />
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Edit profile</Sheet.Title>
          <Sheet.Description>Update profile details from the side panel.</Sheet.Description>
        </Sheet.Header>
        <div className="grid gap-3 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-name">Name</Label>
            <Input id="sheet-name" defaultValue="Voila" />
          </div>
        </div>
        <Sheet.Footer>
          <Sheet.Close render={<Button>Save</Button>} />
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  ),
};
