import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chart, type ChartConfig } from "@voila/ui";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

const meta: Meta = {
  title: "Primitives/Chart",
};

export default meta;

const data = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

const config: ChartConfig = {
  desktop: { label: "Desktop", color: "hsl(var(--primary))" },
  mobile: { label: "Mobile", color: "hsl(var(--muted-foreground))" },
};

export const Default: StoryObj = {
  render: () => (
    <Chart.Container config={config} className="h-[260px] w-[480px]">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <Chart.Tooltip content={<Chart.TooltipContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
      </BarChart>
    </Chart.Container>
  ),
};
