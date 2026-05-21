import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Tabs",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Tabs.Root defaultValue="account" className="w-80">
      <Tabs.List>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password">Password</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account" className="rounded-md border p-4 text-sm">
        Make changes to your account here.
      </Tabs.Content>
      <Tabs.Content value="password" className="rounded-md border p-4 text-sm">
        Change your password here.
      </Tabs.Content>
    </Tabs.Root>
  ),
};
