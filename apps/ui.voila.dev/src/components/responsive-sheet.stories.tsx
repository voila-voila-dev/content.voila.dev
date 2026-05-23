import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Input, Label, ResponsiveSheet } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/ResponsiveSheet",
  parameters: {
    docs: {
      description: {
        component:
          "Sheet on desktop, bottom Drawer on mobile. Resize the viewport below 768px to see the mobile variant.",
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <ResponsiveSheet.Root>
      <ResponsiveSheet.Trigger>
        <Button variant="outline">Open responsive sheet</Button>
      </ResponsiveSheet.Trigger>
      <ResponsiveSheet.Content>
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Edit profile</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Same component, two presentations: side sheet on desktop, bottom drawer on mobile.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        <div className="grid gap-3 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="responsive-sheet-name">Name</Label>
            <Input id="responsive-sheet-name" defaultValue="Voila" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="responsive-sheet-email">Email</Label>
            <Input id="responsive-sheet-email" defaultValue="hello@voila.dev" />
          </div>
        </div>
        <ResponsiveSheet.Footer>
          <ResponsiveSheet.Close>
            <Button>Save</Button>
          </ResponsiveSheet.Close>
        </ResponsiveSheet.Footer>
      </ResponsiveSheet.Content>
    </ResponsiveSheet.Root>
  ),
};

export const Mobile: StoryObj = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: () => (
    <ResponsiveSheet.Root>
      <ResponsiveSheet.Trigger>
        <Button variant="outline">Open as drawer</Button>
      </ResponsiveSheet.Trigger>
      <ResponsiveSheet.Content>
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Move goal</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>Set your daily activity goal.</ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        <div className="p-4 text-center font-bold text-4xl">350 kcal</div>
        <ResponsiveSheet.Footer>
          <Button>Submit</Button>
          <ResponsiveSheet.Close>
            <Button variant="outline">Cancel</Button>
          </ResponsiveSheet.Close>
        </ResponsiveSheet.Footer>
      </ResponsiveSheet.Content>
    </ResponsiveSheet.Root>
  ),
};
