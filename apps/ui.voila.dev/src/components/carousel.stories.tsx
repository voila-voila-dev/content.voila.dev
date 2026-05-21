import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, Carousel } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Carousel",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Carousel.Root className="w-72">
      <Carousel.Content>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable demo slides
          <Carousel.Item key={i}>
            <Card.Root className="flex aspect-square items-center justify-center text-4xl font-semibold">
              {i + 1}
            </Card.Root>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next />
    </Carousel.Root>
  ),
};
