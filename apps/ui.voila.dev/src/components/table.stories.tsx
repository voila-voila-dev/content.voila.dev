import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table } from "@voila/ui";

const meta: Meta = {
  title: "Primitives/Table",
};

export default meta;

const invoices = [
  { invoice: "INV001", status: "Paid", method: "Card", total: "$250.00" },
  { invoice: "INV002", status: "Pending", method: "PayPal", total: "$150.00" },
  { invoice: "INV003", status: "Unpaid", method: "Bank", total: "$350.00" },
];

export const Default: StoryObj = {
  render: () => (
    <Table.Root className="w-[480px]">
      <Table.Caption>A list of your recent invoices.</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Invoice</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Method</Table.Head>
          <Table.Head className="text-right">Total</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {invoices.map((row) => (
          <Table.Row key={row.invoice}>
            <Table.Cell className="font-medium">{row.invoice}</Table.Cell>
            <Table.Cell>{row.status}</Table.Cell>
            <Table.Cell>{row.method}</Table.Cell>
            <Table.Cell className="text-right">{row.total}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  ),
};
