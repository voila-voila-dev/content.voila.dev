import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { CollectionForm } from "./collection-form";
import { LocalizedFieldEditor } from "./localized-field";
import { defaultEditRegistry } from "./registry/edit";

afterEach(cleanup);

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ localized: true }),
    slug: fields.slug(),
  },
});

// Narrow the localized field to the project locales, like a real config does.
const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { posts },
});

const LOCALES = ["en-US", "fr-FR"] as const;

describe("LocalizedFieldEditor", () => {
  const field = config.collections.posts.fields.title;

  test("renders one inner-widget input per locale, labeled by tag", () => {
    const { container } = render(
      <LocalizedFieldEditor
        field={field}
        locales={LOCALES}
        value={{ "en-US": "Hello" }}
        onChange={mock()}
        id="posts-title"
        registry={defaultEditRegistry}
      />,
    );
    expect(screen.getByText("en-US")).toBeDefined();
    expect(screen.getByText("fr-FR")).toBeDefined();
    const en = container.querySelector("#posts-title-en-US") as HTMLInputElement;
    const fr = container.querySelector("#posts-title-fr-FR") as HTMLInputElement;
    expect(en.value).toBe("Hello");
    expect(fr.value).toBe("");
  });

  test("merges a locale's edit into the record value", () => {
    const onChange = mock();
    const { container } = render(
      <LocalizedFieldEditor
        field={field}
        locales={LOCALES}
        value={{ "en-US": "Hello" }}
        onChange={onChange}
        id="posts-title"
        registry={defaultEditRegistry}
      />,
    );
    fireEvent.change(container.querySelector("#posts-title-fr-FR") as HTMLInputElement, {
      target: { value: "Bonjour" },
    });
    // onChange emits a functional updater; resolve it against the prior record.
    const update = onChange.mock.calls[0]?.[0] as (prev: unknown) => unknown;
    expect(update({ "en-US": "Hello" })).toEqual({ "en-US": "Hello", "fr-FR": "Bonjour" });
  });

  test("labels each locale's switch with the form label plus the locale badge", () => {
    const flags = defineCollection({
      slug: "flags",
      fields: { published: fields.boolean({ localized: true }) },
    });
    const cfg = defineConfig({
      branding: { name: "Test" },
      i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
      collections: { flags },
    });
    render(
      <>
        <span id="flags-published-label">Published</span>
        <LocalizedFieldEditor
          field={cfg.collections.flags.fields.published}
          locales={LOCALES}
          value={{ "en-US": true }}
          onChange={mock()}
          id="flags-published"
          labelId="flags-published-label"
          registry={defaultEditRegistry}
        />
      </>,
    );
    expect(screen.getByText("en-US").id).toBe("flags-published-en-US-label");
    const sw = screen.getByRole("switch", { name: "Published en-US" });
    expect(sw.getAttribute("aria-labelledby")).toBe(
      "flags-published-label flags-published-en-US-label",
    );
  });

  test("treats a non-record value as empty", () => {
    const { container } = render(
      <LocalizedFieldEditor
        field={field}
        locales={LOCALES}
        value="garbage"
        onChange={mock()}
        id="posts-title"
        registry={defaultEditRegistry}
      />,
    );
    expect((container.querySelector("#posts-title-en-US") as HTMLInputElement).value).toBe("");
  });
});

describe("CollectionForm + locales", () => {
  test("routes localized fields through the per-locale editor", () => {
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={LOCALES}
        onSubmit={mock()}
        defaultValues={{ title: { "en-US": "Hello" } }}
      />,
    );
    // Two locale inputs for `title`, one plain input for `slug`.
    expect(container.querySelector("#posts-title-en-US")).not.toBeNull();
    expect(container.querySelector("#posts-title-fr-FR")).not.toBeNull();
    expect(container.querySelector("#posts-slug")).not.toBeNull();
    // The label points at the first locale's control.
    expect(container.querySelector('label[for="posts-title-en-US"]')?.textContent).toContain(
      "Title",
    );
  });

  test("submits the merged per-locale record", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={LOCALES}
        onSubmit={onSubmit}
        defaultValues={{ title: { "en-US": "Hello" }, slug: "hello" }}
      />,
    );
    fireEvent.change(container.querySelector("#posts-title-fr-FR") as HTMLInputElement, {
      target: { value: "Bonjour" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      title: { "en-US": "Hello", "fr-FR": "Bonjour" },
      slug: "hello",
    });
  });

  test("falls back to the plain widget without a locales prop", () => {
    const { container } = render(
      <CollectionForm collection={config.collections.posts} onSubmit={mock()} />,
    );
    expect(container.querySelector("#posts-title")).not.toBeNull();
    expect(container.querySelector("#posts-title-en-US")).toBeNull();
  });
});
