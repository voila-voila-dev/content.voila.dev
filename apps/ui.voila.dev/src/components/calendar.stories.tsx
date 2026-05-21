import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "@voila/ui";
import { useState } from "react";

const meta: Meta = {
  title: "Primitives/Calendar",
};

export default meta;

export const Default: StoryObj = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <Calendar.Root
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
      />
    );
  },
};
