import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { CollectionForm } from "./collection-form";

afterEach(cleanup);

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true, min: 3 }),
    views: fields.number(),
    secret: fields.string({ hidden: true }),
  },
});

function form(container: HTMLElement): HTMLFormElement {
  return container.querySelector("form") as HTMLFormElement;
}

describe("CollectionForm", () => {
  test("renders a labeled control per non-hidden field, skipping hidden", () => {
    render(<CollectionForm collection={posts} onSubmit={mock()} />);
    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Views")).toBeDefined();
    expect(screen.queryByText("Secret")).toBeNull();
  });

  test("marks required fields with an asterisk", () => {
    const { container } = render(<CollectionForm collection={posts} onSubmit={mock()} />);
    // The label text node holds "Title" + a "*" marker span.
    const titleLabel = container.querySelector('label[for="posts-title"]');
    expect(titleLabel?.textContent).toContain("*");
    expect(container.querySelector('label[for="posts-views"]')?.textContent).not.toContain("*");
  });

  test("submits decoded, validated values", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm collection={posts} onSubmit={onSubmit} defaultValues={{ title: "Hello" }} />,
    );
    fireEvent.submit(form(container));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: "Hello" });
  });

  test("blocks submission and shows errors when invalid", () => {
    const onSubmit = mock();
    const { container } = render(<CollectionForm collection={posts} onSubmit={onSubmit} />);
    fireEvent.submit(form(container));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Required.")).toBeDefined();
    const input = container.querySelector("#posts-title") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  test("clears a field error as soon as it is edited", () => {
    const { container } = render(<CollectionForm collection={posts} onSubmit={mock()} />);
    fireEvent.submit(form(container));
    expect(screen.getByText("Required.")).toBeDefined();
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "abc" },
    });
    expect(screen.queryByText("Required.")).toBeNull();
  });

  test("renders a form-level error", () => {
    render(
      <CollectionForm collection={posts} onSubmit={mock()} error="That slug already exists." />,
    );
    expect(screen.getByText("That slug already exists.")).toBeDefined();
  });

  test("renders an explicit field subset in order", () => {
    const { container } = render(
      <CollectionForm collection={posts} onSubmit={mock()} fields={["views", "title"]} />,
    );
    const labels = [...container.querySelectorAll("label")].map((l) => l.getAttribute("for"));
    expect(labels).toEqual(["posts-views", "posts-title"]);
  });

  test("the submit button is type=submit (not the Button default)", () => {
    render(<CollectionForm collection={posts} onSubmit={mock()} submitLabel="Create" />);
    expect(screen.getByRole("button", { name: "Create" }).getAttribute("type")).toBe("submit");
  });
});
