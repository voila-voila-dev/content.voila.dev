import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Card } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Card",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Card.Root className="w-80">
      <Card.Header.Root>
        <Card.Header.Title>Create project</Card.Header.Title>
        <Card.Header.Description>Deploy your new project in one click.</Card.Header.Description>
      </Card.Header.Root>
      <Card.Content>
        <p className="text-sm">Set a name and pick a framework — that's it.</p>
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button>
      </Card.Footer>
    </Card.Root>
  ),
};
