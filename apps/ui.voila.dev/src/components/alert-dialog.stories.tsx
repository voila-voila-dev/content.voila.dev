import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertDialog, Button } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/AlertDialog",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={<Button variant="outline">Delete account</Button>} />
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone. This will permanently delete your account.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action variant="destructive">Continue</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  ),
};
