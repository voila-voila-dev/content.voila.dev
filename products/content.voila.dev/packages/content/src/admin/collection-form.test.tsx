import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { number, select, string } from "@voila/content-schema";
import { CollectionForm } from "./collection-form.tsx";

afterEach(cleanup);

const fields = {
  title: string({ required: true, min: 3 }),
  status: select({ required: true, options: ["draft", "published"] }),
};

const validValues = { title: "Hello", status: "draft" };

function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form not found");
  fireEvent.submit(form);
}

describe("CollectionForm", () => {
  test("renders a labelled widget per field plus a save button", () => {
    render(<CollectionForm fields={fields} initialValues={validValues} onSubmit={() => {}} />);
    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByRole("button", { name: /save/i })).toBeDefined();
  });

  test("submits the validated document with defaults applied", async () => {
    let received: Record<string, unknown> | undefined;
    const { container } = render(
      <CollectionForm
        fields={{ ...fields, views: number({ default: 0 }) }}
        initialValues={validValues}
        onSubmit={(value) => {
          received = value;
        }}
      />,
    );
    submitForm(container);
    await waitFor(() => expect(received).toBeDefined());
    expect(received).toMatchObject({ title: "Hello", status: "draft", views: 0 });
  });

  test("renders a field-level error when a per-field validator fails", async () => {
    const { container } = render(
      <CollectionForm fields={fields} initialValues={validValues} onSubmit={() => {}} />,
    );
    const titleInput = container.querySelector("#field-title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "ab" } }); // min: 3
    fireEvent.blur(titleInput);
    await waitFor(() => {
      const errorNode = container.querySelector("#field-title-error");
      expect(errorNode).not.toBeNull();
    });
    expect(titleInput.getAttribute("aria-invalid")).toBe("true");
  });

  test("does not call onSubmit while a field is invalid", async () => {
    let called = false;
    const { container } = render(
      <CollectionForm
        fields={fields}
        initialValues={{ title: "ab", status: "draft" }}
        onSubmit={() => {
          called = true;
        }}
      />,
    );
    submitForm(container);
    await waitFor(() => expect(container.querySelector("#field-title-error")).not.toBeNull());
    expect(called).toBe(false);
  });

  test("shows a form-level submit error with retry, then recovers", async () => {
    let attempts = 0;
    const { container } = render(
      <CollectionForm
        fields={fields}
        initialValues={validValues}
        onSubmit={() => {
          attempts += 1;
          if (attempts === 1) throw new Error("Server unavailable");
        }}
      />,
    );
    submitForm(container);
    expect(await screen.findByText("Server unavailable")).toBeDefined();

    // The save button is replaced by a retry affordance (a submit button).
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
    submitForm(container); // activate it
    await waitFor(() => expect(attempts).toBe(2));
    await waitFor(() => expect(screen.queryByText("Server unavailable")).toBeNull());
  });

  test("maps thrown server field errors back onto the field", async () => {
    const { container } = render(
      <CollectionForm
        fields={fields}
        initialValues={validValues}
        onSubmit={() => {
          throw { fields: { title: ["Title is already taken"] } };
        }}
      />,
    );
    submitForm(container);
    expect(await screen.findByText("Title is already taken")).toBeDefined();
  });
});
