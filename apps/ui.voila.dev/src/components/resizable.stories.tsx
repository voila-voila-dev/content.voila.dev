import type { Meta, StoryObj } from "@storybook/react-vite";
import { Resizable } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Resizable",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Resizable.PanelGroup direction="horizontal" className="h-40 w-[480px] rounded-lg border">
      <Resizable.Panel defaultSize={40}>
        <div className="flex h-full items-center justify-center p-4 text-sm">Sidebar</div>
      </Resizable.Panel>
      <Resizable.Handle withHandle />
      <Resizable.Panel>
        <div className="flex h-full items-center justify-center p-4 text-sm">Content</div>
      </Resizable.Panel>
    </Resizable.PanelGroup>
  ),
};
