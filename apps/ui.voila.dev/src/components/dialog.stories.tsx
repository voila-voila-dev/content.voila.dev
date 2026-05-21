import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Dialog, Input, Label } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Dialog",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline">Edit profile</Button>} />
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Update your profile details.</Dialog.Description>
        </Dialog.Header>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="Voila" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" defaultValue="@voila" />
          </div>
        </div>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="outline">Cancel</Button>} />
          <Dialog.Close render={<Button>Save</Button>} />
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  ),
};
