import type { Meta, StoryObj } from "@storybook/react-vite";
import { Accordion } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Accordion",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Accordion.Root className="w-80">
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
        <Accordion.Content>Yes. It uses Base UI under the hood.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger>Is it styled?</Accordion.Trigger>
        <Accordion.Content>
          Yes. It picks up Voila tokens and Tailwind utilities by default.
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-3">
        <Accordion.Trigger>Is it animated?</Accordion.Trigger>
        <Accordion.Content>
          Yes. Expanding and collapsing transitions are built in.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  ),
};
