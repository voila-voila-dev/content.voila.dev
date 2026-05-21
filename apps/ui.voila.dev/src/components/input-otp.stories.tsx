import type { Meta, StoryObj } from "@storybook/react-vite";
import { InputOTP } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/InputOTP",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <InputOTP.Root maxLength={6}>
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        <InputOTP.Slot index={3} />
        <InputOTP.Slot index={4} />
        <InputOTP.Slot index={5} />
      </InputOTP.Group>
    </InputOTP.Root>
  ),
};
