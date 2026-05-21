import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Drawer } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Drawer",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <Button variant="outline">Open drawer</Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Move goal</Drawer.Title>
          <Drawer.Description>Set your daily activity goal.</Drawer.Description>
        </Drawer.Header>
        <div className="p-4 text-center text-4xl font-bold">350 kcal</div>
        <Drawer.Footer>
          <Button>Submit</Button>
          <Drawer.Close asChild>
            <Button variant="outline">Cancel</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer.Root>
  ),
};
