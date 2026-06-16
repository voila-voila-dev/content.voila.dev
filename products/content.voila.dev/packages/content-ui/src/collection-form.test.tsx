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

  test("a boolean field's switch takes its accessible name from the label", () => {
    const flags = defineCollection({
      slug: "flags",
      fields: { published: fields.boolean() },
    });
    render(<CollectionForm collection={flags} onSubmit={mock()} />);
    const sw = screen.getByRole("switch", { name: "Published" });
    expect(sw.getAttribute("aria-labelledby")).toBe("flags-published-label");
  });
});

describe("CollectionForm — serverErrors", () => {
  test("lands on the offending field's inline error slot", () => {
    const { container } = render(
      <CollectionForm
        collection={posts}
        onSubmit={mock()}
        serverErrors={{ title: "Already in use." }}
      />,
    );
    expect(container.querySelector("#posts-title-error")?.textContent).toBe("Already in use.");
  });

  test("a new serverErrors object arriving after a failed submit is adopted", () => {
    const { container, rerender } = render(<CollectionForm collection={posts} onSubmit={mock()} />);
    expect(screen.queryByText("Already in use.")).toBeNull();
    rerender(
      <CollectionForm
        collection={posts}
        onSubmit={mock()}
        serverErrors={{ title: "Already in use." }}
      />,
    );
    expect(container.querySelector("#posts-title-error")?.textContent).toBe("Already in use.");
  });

  test("clears like a local error once the field is edited", () => {
    const { container } = render(
      <CollectionForm
        collection={posts}
        onSubmit={mock()}
        serverErrors={{ title: "Already in use." }}
      />,
    );
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "Another title" },
    });
    expect(screen.queryByText("Already in use.")).toBeNull();
  });

  test("a key without a rendered field surfaces form-level", () => {
    render(
      <CollectionForm
        collection={posts}
        onSubmit={mock()}
        serverErrors={{ secret: "Not allowed." }}
      />,
    );
    // `secret` is hidden, so the error renders in the form-level slot instead.
    expect(screen.getByText("Secret: Not allowed.")).toBeDefined();
  });
});

describe("CollectionForm — slug derivation (`slug({ from })`)", () => {
  const articles = defineCollection({
    slug: "articles",
    fields: {
      title: fields.string({ required: true }),
      slug: fields.slug({ from: "title" }),
    },
  });

  function inputs(container: HTMLElement) {
    return {
      title: container.querySelector("#articles-title") as HTMLInputElement,
      slug: container.querySelector("#articles-slug") as HTMLInputElement,
    };
  }

  test("derives the slug as the source field is typed", () => {
    const { container } = render(<CollectionForm collection={articles} onSubmit={mock()} />);
    const { title, slug } = inputs(container);
    fireEvent.change(title, { target: { value: "Crème Brûlée 101" } });
    expect(slug.value).toBe("creme-brulee-101");
    fireEvent.change(title, { target: { value: "Hello World" } });
    expect(slug.value).toBe("hello-world");
  });

  test("hand-editing the slug latches it against further derivation", () => {
    const { container } = render(<CollectionForm collection={articles} onSubmit={mock()} />);
    const { title, slug } = inputs(container);
    fireEvent.change(title, { target: { value: "First" } });
    fireEvent.change(slug, { target: { value: "custom" } });
    fireEvent.change(title, { target: { value: "Second Title" } });
    expect(slug.value).toBe("custom");
  });

  test("clearing the slug re-opens the latch", () => {
    const { container } = render(<CollectionForm collection={articles} onSubmit={mock()} />);
    const { title, slug } = inputs(container);
    fireEvent.change(slug, { target: { value: "custom" } });
    fireEvent.change(slug, { target: { value: "" } });
    fireEvent.change(title, { target: { value: "Back Again" } });
    expect(slug.value).toBe("back-again");
  });

  test("an existing document's slug starts latched (edit mode)", () => {
    const { container } = render(
      <CollectionForm
        collection={articles}
        onSubmit={mock()}
        defaultValues={{ title: "Old", slug: "old" }}
      />,
    );
    const { title, slug } = inputs(container);
    fireEvent.change(title, { target: { value: "Renamed" } });
    expect(slug.value).toBe("old");
  });

  test("the derived slug submits like a typed one", async () => {
    const onSubmit = mock();
    const { container } = render(<CollectionForm collection={articles} onSubmit={onSubmit} />);
    fireEvent.change(inputs(container).title, { target: { value: "My Post" } });
    fireEvent.submit(form(container));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: "My Post", slug: "my-post" });
  });
});
