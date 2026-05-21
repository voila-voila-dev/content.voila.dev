import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "@voila/ui";
import { InfoIcon, WarningIcon } from "@voila/ui/icons";

const meta: Meta = {
  title: "Primitives/Alert",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Alert.Root className="w-96">
      <InfoIcon />
      <Alert.Title>Heads up!</Alert.Title>
      <Alert.Description>You can add components to your app using the CLI.</Alert.Description>
    </Alert.Root>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert.Root variant="destructive" className="w-96">
      <WarningIcon />
      <Alert.Title>Something went wrong</Alert.Title>
      <Alert.Description>Your session has expired. Please log in again.</Alert.Description>
    </Alert.Root>
  ),
};
