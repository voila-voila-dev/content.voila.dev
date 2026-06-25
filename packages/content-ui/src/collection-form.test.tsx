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

  test("focuses the first invalid field on a failed submit", () => {
    const { container } = render(<CollectionForm collection={posts} onSubmit={mock()} />);
    fireEvent.submit(form(container));
    // `title` is the first (and only) invalid field — focus lands on its input.
    expect(document.activeElement).toBe(container.querySelector("#posts-title"));
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

describe("CollectionForm — unsaved-changes guard", () => {
  // Did a `beforeunload` listener veto the navigation? (preventDefault → prompt.)
  function wouldPromptOnLeave(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  test("a pristine form lets the page unload without a prompt", () => {
    render(<CollectionForm collection={posts} onSubmit={mock()} />);
    expect(wouldPromptOnLeave()).toBe(false);
  });

  test("prompts before unload once a field is edited", () => {
    const { container } = render(<CollectionForm collection={posts} onSubmit={mock()} />);
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "Draft" },
    });
    expect(wouldPromptOnLeave()).toBe(true);
  });

  test("stops guarding after a successful submit", async () => {
    const { container } = render(
      <CollectionForm collection={posts} onSubmit={mock()} defaultValues={{ title: "Hello" }} />,
    );
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "Hello world" },
    });
    expect(wouldPromptOnLeave()).toBe(true);
    fireEvent.submit(form(container));
    await waitFor(() => expect(wouldPromptOnLeave()).toBe(false));
  });
});

describe("CollectionForm — field groups", () => {
  const grouped = defineCollection({
    slug: "posts",
    fields: {
      title: fields.string({ required: true }),
      body: fields.string(),
      seo: fields.string({ required: true }),
    },
    groups: [
      { id: "content", label: "Content", fields: ["title", "body"] },
      { id: "meta", label: "Metadata", fields: ["seo"] },
    ],
  });

  test("renders a sub-nav and only the active group's fields (first by default)", () => {
    const { container } = render(<CollectionForm collection={grouped} onSubmit={mock()} />);
    expect(screen.getByRole("button", { name: "Content" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Metadata" })).toBeDefined();
    // Active = first group (content) → title/body shown, seo (group meta) hidden.
    expect(container.querySelector("#posts-title")).not.toBeNull();
    expect(container.querySelector("#posts-seo")).toBeNull();
  });

  test("selecting a group in the sub-nav switches the rendered fields", () => {
    const { container } = render(<CollectionForm collection={grouped} onSubmit={mock()} />);
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(container.querySelector("#posts-seo")).not.toBeNull();
    expect(container.querySelector("#posts-title")).toBeNull();
  });

  test("the footer Save submits the whole form, including other groups' fields", async () => {
    const onSubmit = mock();
    render(
      <CollectionForm
        collection={grouped}
        onSubmit={onSubmit}
        defaultValues={{ title: "T", body: "B", seo: "S" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // `seo` lives in the inactive `meta` group but is still validated + submitted.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: "T", body: "B", seo: "S" });
  });

  test("a failed submit switches to the failing field's group and focuses it", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={onSubmit}
        defaultValues={{ title: "T", body: "B", seo: "" }}
      />,
    );
    // `seo` (required, empty) lives in the inactive `meta` group.
    fireEvent.submit(form(container));
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(container.querySelector("#posts-seo")).not.toBeNull());
    // The form switched to `meta` and moved focus onto the offending field.
    await waitFor(() => expect(document.activeElement?.id).toBe("posts-seo"));
    expect(screen.getByRole("button", { name: "Metadata" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("an in-group failure focuses synchronously without switching groups", () => {
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        defaultValues={{ title: "", body: "B", seo: "S" }}
      />,
    );
    fireEvent.submit(form(container));
    // `title` is in the active `content` group → focus lands at once, no switch.
    expect(document.activeElement?.id).toBe("posts-title");
  });

  test("notifies onGroupChange and reflects the controlled activeGroup", () => {
    const onGroupChange = mock();
    const { container, rerender } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        activeGroup="meta"
        onGroupChange={onGroupChange}
      />,
    );
    expect(container.querySelector("#posts-seo")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Content" }));
    expect(onGroupChange).toHaveBeenCalledWith("content");
    // Controlled: a new prop value drives which group renders.
    rerender(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        activeGroup="content"
        onGroupChange={onGroupChange}
      />,
    );
    expect(container.querySelector("#posts-title")).not.toBeNull();
  });

  test("surfaces a server error on a field in another group and switches to it", async () => {
    // Regression: a 409/422 keyed to a field in a non-active group used to render
    // nowhere (not inline, not form-level). It must now be visible.
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        serverErrors={{ seo: "Already in use." }}
      />,
    );
    // The effect switches to `seo`'s group (meta); its input mounts and the
    // inline error shows.
    await waitFor(() => expect(container.querySelector("#posts-seo")).not.toBeNull());
    expect(screen.getByText("Already in use.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Metadata" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("slug derivation works across groups (shared form state)", () => {
    const withSlug = defineCollection({
      slug: "posts",
      fields: {
        title: fields.string({ required: true }),
        slug: fields.slug({ from: "title" }),
      },
      groups: [
        { id: "content", fields: ["title"] },
        { id: "meta", fields: ["slug"] },
      ],
    });
    const { container } = render(<CollectionForm collection={withSlug} onSubmit={mock()} />);
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "Hello World" },
    });
    // Switch to the `meta` group: the slug derived from a field in another group.
    fireEvent.click(screen.getByRole("button", { name: "Meta" }));
    expect((container.querySelector("#posts-slug") as HTMLInputElement).value).toBe("hello-world");
  });
});

describe('CollectionForm — per-field save (saveMode="field")', () => {
  const grouped = defineCollection({
    slug: "posts",
    fields: {
      title: fields.string({ required: true }),
      body: fields.string(),
      seo: fields.string({ required: true }),
    },
    groups: [
      { id: "content", label: "Content", fields: ["title", "body"] },
      { id: "meta", label: "Metadata", fields: ["seo"] },
    ],
  });

  test("each active-group field gets its own Save, disabled until edited", () => {
    render(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        saveMode="field"
        defaultValues={{ title: "T", body: "B", seo: "S" }}
      />,
    );
    const saves = screen.getAllByRole("button", { name: "Save" }) as HTMLButtonElement[];
    expect(saves).toHaveLength(2);
    expect(saves.every((b) => b.disabled)).toBe(true);
  });

  test("editing one field enables only its Save and submits a one-key partial", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={onSubmit}
        saveMode="field"
        defaultValues={{ title: "T", body: "B", seo: "S" }}
      />,
    );
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "New title" },
    });
    const saves = screen.getAllByRole("button", { name: "Save" }) as HTMLButtonElement[];
    const enabled = saves.filter((b) => !b.disabled);
    expect(enabled).toHaveLength(1);
    fireEvent.click(enabled[0] as HTMLButtonElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: "New title" });
  });

  test("clearing an optional field saves an explicit null (so the PATCH clears it)", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={onSubmit}
        saveMode="field"
        defaultValues={{ title: "T", body: "B", seo: "S" }}
      />,
    );
    // Clear the optional `body` field and save its card.
    fireEvent.change(container.querySelector("#posts-body") as HTMLInputElement, {
      target: { value: "" },
    });
    fireEvent.click(
      (screen.getAllByRole("button", { name: "Save" }) as HTMLButtonElement[]).find(
        (b) => !b.disabled,
      ) as HTMLButtonElement,
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ body: null });
  });

  test("a field that fails validation isn't submitted", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={onSubmit}
        saveMode="field"
        defaultValues={{ title: "ok", body: "B", seo: "S" }}
      />,
    );
    fireEvent.change(container.querySelector("#posts-title") as HTMLInputElement, {
      target: { value: "" }, // required → invalid
    });
    fireEvent.click(
      (screen.getAllByRole("button", { name: "Save" }) as HTMLButtonElement[]).find(
        (b) => !b.disabled,
      ) as HTMLButtonElement,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
