import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Form, Input } from "@voila/ui";
import { useForm } from "react-hook-form";

const meta: Meta = {
  title: "Primitives/Form",
};

export default meta;

type Values = { username: string };

function Demo() {
  const form = useForm<Values>({ defaultValues: { username: "" } });
  const onSubmit = form.handleSubmit((values) => {
    // eslint-disable-next-line no-alert
    alert(`Submitted: ${JSON.stringify(values)}`);
  });

  return (
    <Form.Root {...form}>
      <form className="w-72 space-y-4" onSubmit={onSubmit}>
        <Form.Field
          control={form.control}
          name="username"
          rules={{
            required: "Username is required",
            minLength: { value: 2, message: "Too short" },
          }}
          render={({ field }) => (
            <Form.Item>
              <Form.Label>Username</Form.Label>
              <Form.Control render={<Input placeholder="@voila" {...field} />} />
              <Form.Description>This is your public display name.</Form.Description>
              <Form.Message />
            </Form.Item>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form.Root>
  );
}

export const Default: StoryObj = { render: () => <Demo /> };
