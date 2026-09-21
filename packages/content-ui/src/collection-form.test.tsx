import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { type ReactNode, useEffect, useRef } from "react";
import { CollectionForm } from "./collection-form";
import { defaultEditRegistry } from "./registry/edit";
import type { EditWidgetProps } from "./widgets/edit";

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

  test("no Save shows until a field is edited; the section is one card", () => {
    const { container } = render(
      <CollectionForm
        collection={grouped}
        onSubmit={mock()}
        saveMode="field"
        defaultValues={{ title: "T", body: "B", seo: "S" }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(container.querySelectorAll('[data-slot="field-card-card"]')).toHaveLength(1);
    // Only the active group's fields render.
    expect(container.querySelector("#posts-title")).not.toBeNull();
    expect(container.querySelector("#posts-seo")).toBeNull();
  });

  test("a saved field flashes a Saved confirmation", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Saved"));
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

describe("unsaved-changes reporting", () => {
  // The bug this guards: a widget that normalises its value on mount made the
  // form report unsaved edits before the user had typed anything, which armed
  // the host's navigation guard and trapped the editor on a blank form.
  const withRichText = defineCollection({
    slug: "notes",
    fields: { title: fields.string(), body: fields.richText() },
  });

  /**
   * Stands in for the rich-text editor: emits a normalised empty doc ONCE on
   * mount. The `onChange` prop is a fresh closure each render, so the emit is
   * pinned to mount through a ref — exactly as a real editor does, and without
   * it the effect would re-fire forever.
   */
  function NormalisingWidget({ onChange }: EditWidgetProps): ReactNode {
    const emit = useRef(onChange);
    emit.current = onChange;
    useEffect(() => {
      emit.current([{ id: "1", type: "paragraph", children: [{ text: "" }] }]);
    }, []);
    return <div data-testid="normalising" />;
  }

  function isDirty(container: HTMLElement): boolean {
    return (
      container.querySelector("[data-slot=collection-form]")?.hasAttribute("data-dirty") === true
    );
  }

  test("a freshly opened form reports no unsaved changes", async () => {
    const onDirtyChange = mock();
    const { container } = render(
      <CollectionForm
        collection={withRichText}
        registry={{ ...defaultEditRegistry, richText: NormalisingWidget }}
        onSubmit={mock()}
        onDirtyChange={onDirtyChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("normalising")).toBeDefined());
    expect(isDirty(container)).toBe(false);
    // It may be called with `false`, but never with `true`.
    expect(onDirtyChange.mock.calls.every(([dirty]) => dirty === false)).toBe(true);
  });

  test("typing reports unsaved changes", async () => {
    const onDirtyChange = mock();
    const { container } = render(
      <CollectionForm collection={withRichText} onSubmit={mock()} onDirtyChange={onDirtyChange} />,
    );
    fireEvent.change(container.querySelector("#notes-title") as HTMLInputElement, {
      target: { value: "Hello" },
    });
    await waitFor(() => expect(isDirty(container)).toBe(true));
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  test("typing and then undoing it reports clean again", async () => {
    const { container } = render(<CollectionForm collection={withRichText} onSubmit={mock()} />);
    const input = container.querySelector("#notes-title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(isDirty(container)).toBe(false));
  });

  test("a successful submit clears the unsaved flag", async () => {
    const { container } = render(<CollectionForm collection={withRichText} onSubmit={mock()} />);
    fireEvent.change(container.querySelector("#notes-title") as HTMLInputElement, {
      target: { value: "Hello" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(isDirty(container)).toBe(false));
  });
});

describe("CollectionForm — structured fields (blocks / object / array)", () => {
  const pages = defineCollection({
    slug: "pages",
    fields: {
      title: fields.string({ required: true }),
      sections: fields.blocks({
        types: {
          hero: { fields: { headline: fields.string({ required: true }) } },
          cta: { fields: { label: fields.string() } },
        },
      }),
    },
  });

  test("renders the blocks editor, surfaces a nested error on submit, and submits decoded", async () => {
    const onSubmit = mock(async () => {});
    render(
      <CollectionForm
        collection={pages}
        defaultValues={{ title: "Home", sections: [{ type: "hero" }] }}
        onSubmit={onSubmit}
        title="Edit"
      />,
    );
    // The blocks widget is mounted under the field's id.
    expect(document.querySelector("[data-slot=blocks-input]")?.id).toBe("pages-sections");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // The nested control shows its own message, and the field-level line
    // carries the sub-path so the row still points somewhere.
    await waitFor(() => {
      expect(document.getElementById("pages-sections-0-headline-error")?.textContent).toBe(
        "Required.",
      );
    });
    expect(document.getElementById("pages-sections-error")?.textContent).toBe(
      "[0].headline: Required.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    // Fixing the nested field clears both messages and submits the decoded value.
    fireEvent.change(document.getElementById("pages-sections-0-headline") as HTMLInputElement, {
      target: { value: "Hi" },
    });
    expect(document.getElementById("pages-sections-error")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      title: "Home",
      sections: [{ type: "hero", headline: "Hi" }],
    });
  });

  test("resolves nested widgets through the form's registry", () => {
    const Custom = ({ id }: EditWidgetProps) => <input id={id} data-custom />;
    render(
      <CollectionForm
        collection={pages}
        defaultValues={{ sections: [{ type: "cta", label: "Go" }] }}
        registry={{ ...defaultEditRegistry, string: Custom }}
        onSubmit={mock()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Expand block 1/ }));
    expect(document.getElementById("pages-sections-0-label")?.hasAttribute("data-custom")).toBe(
      true,
    );
  });
});

describe("CollectionForm — readOnly fields", () => {
  const listings = defineCollection({
    slug: "listings",
    fields: {
      title: fields.string({ required: true }),
      ref: fields.string({ readOnly: true }),
      price: fields.number({ readOnly: true }),
    },
  });

  test("an edit renders a readOnly field with its display widget, not an input", () => {
    const { container } = render(
      <CollectionForm
        collection={listings}
        onSubmit={mock()}
        defaultValues={{ title: "Villa", ref: "AB-12", price: 30000 }}
      />,
    );
    expect(screen.getByText("Ref")).toBeDefined();
    expect(container.querySelector("#listings-ref")).toBeNull();
    const rows = container.querySelectorAll("[data-slot=readonly-field]");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe("AB-12");
    expect(rows[1]?.textContent).toBe((30000).toLocaleString());
    // The editable field is still an input.
    expect(container.querySelector("#listings-title")).not.toBeNull();
  });

  test("a create omits readOnly fields entirely", () => {
    const { container } = render(<CollectionForm collection={listings} onSubmit={mock()} />);
    expect(screen.queryByText("Ref")).toBeNull();
    expect(screen.queryByText("Price")).toBeNull();
    expect(container.querySelector("[data-slot=readonly-field]")).toBeNull();
  });

  test("mode overrides the defaultValues heuristic", () => {
    const { container } = render(
      <CollectionForm collection={listings} onSubmit={mock()} mode="edit" />,
    );
    // No defaults, but an explicit edit still shows the readOnly rows (empty).
    expect(container.querySelectorAll("[data-slot=readonly-field]")).toHaveLength(2);
  });

  test("readOnly values are excluded from the submitted payload", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={listings}
        onSubmit={onSubmit}
        defaultValues={{ title: "Villa", ref: "AB-12", price: 30000 }}
      />,
    );
    fireEvent.submit(form(container));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: "Villa" });
  });

  test("a readOnly field never reads as dirty", () => {
    const { container } = render(
      <CollectionForm
        collection={listings}
        onSubmit={mock()}
        defaultValues={{ title: "Villa", ref: "AB-12" }}
        saveMode="field"
      />,
    );
    const root = container.querySelector("[data-slot=collection-form]");
    expect(root?.getAttribute("data-dirty")).toBeNull();
    expect(container.querySelector("[data-slot=field-save]")).toBeNull();
    fireEvent.change(container.querySelector("#listings-title") as HTMLInputElement, {
      target: { value: "Villa 2" },
    });
    // Only the edited (editable) field grows a Save row.
    expect(container.querySelectorAll("[data-slot=field-save]")).toHaveLength(1);
  });

  test("uses the displayRegistry for readOnly fields", () => {
    const Custom = ({ value }: { value: unknown }) => <b data-testid="custom">{String(value)}</b>;
    render(
      <CollectionForm
        collection={listings}
        onSubmit={mock()}
        defaultValues={{ ref: "AB-12" }}
        displayRegistry={{ string: Custom }}
      />,
    );
    expect(screen.getByTestId("custom").textContent).toBe("AB-12");
  });
});

describe("CollectionForm live values and focus path", () => {
  test("reports the whole document on mount and after every edit", () => {
    const onValuesChange = mock();
    render(
      <CollectionForm
        collection={posts}
        defaultValues={{ title: "Hello", views: 3 }}
        onSubmit={mock()}
        onValuesChange={onValuesChange}
      />,
    );
    expect(onValuesChange).toHaveBeenLastCalledWith({ title: "Hello", views: 3 });
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Hello world" } });
    expect(onValuesChange).toHaveBeenLastCalledWith({ title: "Hello world", views: 3 });
  });

  test("reports the expanded block's path, and null on collapse", () => {
    const pages = defineCollection({
      slug: "pages",
      fields: {
        title: fields.string(),
        blocks: fields.blocks({ types: { hero: { fields: { heading: fields.string() } } } }),
      },
    });
    const onFocusPathChange = mock();
    render(
      <CollectionForm
        collection={pages}
        defaultValues={{
          title: "P",
          blocks: [
            { type: "hero", heading: "One" },
            { type: "hero", heading: "Two" },
          ],
        }}
        onSubmit={mock()}
        onFocusPathChange={onFocusPathChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Expand block 2/ }));
    expect(onFocusPathChange).toHaveBeenLastCalledWith(["blocks", 1]);
    fireEvent.click(screen.getByRole("button", { name: /Collapse block 2/ }));
    expect(onFocusPathChange).toHaveBeenLastCalledWith(null);
  });
});
