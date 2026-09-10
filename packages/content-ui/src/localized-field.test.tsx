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
  /** Click the switcher segment for a locale. */
  function switchTo(locale: string): void {
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(locale) }));
  }

  test("shows one locale at a time, driven by the switcher", () => {
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={mock()}
        defaultValues={{ title: { "en-US": "Hello" } }}
      />,
    );
    // The default locale's input is mounted; the other translation is not.
    expect(container.querySelector("#posts-title-en-US")).not.toBeNull();
    expect(container.querySelector("#posts-title-fr-FR")).toBeNull();
    expect(container.querySelector("#posts-slug")).not.toBeNull();
    expect(container.querySelector('label[for="posts-title-en-US"]')?.textContent).toContain(
      "Title",
    );

    switchTo("fr-FR");
    expect(container.querySelector("#posts-title-fr-FR")).not.toBeNull();
    expect(container.querySelector("#posts-title-en-US")).toBeNull();
    // A non-localized field is unaffected by the switch.
    expect(container.querySelector("#posts-slug")).not.toBeNull();
  });

  test("keeps every locale's edits when switching between them", async () => {
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={onSubmit}
        defaultValues={{ title: { "en-US": "Hello" }, slug: "hello" }}
      />,
    );
    switchTo("fr-FR");
    fireEvent.change(container.querySelector("#posts-title-fr-FR") as HTMLInputElement, {
      target: { value: "Bonjour" },
    });
    // Switching away and back must not drop the translation just typed.
    switchTo("en-US");
    switchTo("fr-FR");
    expect((container.querySelector("#posts-title-fr-FR") as HTMLInputElement).value).toBe(
      "Bonjour",
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      title: { "en-US": "Hello", "fr-FR": "Bonjour" },
      slug: "hello",
    });
  });

  test("shows the default locale's text under an empty translation", () => {
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={mock()}
        defaultValues={{ title: { "en-US": "Hello" } }}
      />,
    );
    switchTo("fr-FR");
    // The translator can see what they are translating without leaving the field.
    expect(container.textContent).toContain("Hello");
  });

  test("a single-locale project gets no switcher", () => {
    const { container } = render(
      <CollectionForm
        collection={config.collections.posts}
        locales={["en-US"]}
        defaultLocale="en-US"
        onSubmit={mock()}
        defaultValues={{ title: { "en-US": "Hello" } }}
      />,
    );
    expect(container.querySelector("[data-slot=locale-switcher]")).toBeNull();
    expect(container.querySelector("#posts-title-en-US")).not.toBeNull();
  });

  // `required` on a localized field means the DEFAULT locale is filled, not that
  // every translation exists — otherwise a monolingual editor could never save.
  function requiredTitleConfig(opts?: { readonly min?: number }) {
    const docs = defineCollection({
      slug: "docs",
      fields: { title: fields.string({ localized: true, required: true, min: opts?.min }) },
    });
    return defineConfig({
      branding: { name: "Test" },
      i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
      collections: { docs },
    });
  }

  test("an untranslated locale does not block submit on a required field", async () => {
    const cfg = requiredTitleConfig();
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.docs}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={onSubmit}
        defaultValues={{ title: { "en-US": "Hello" } }}
      />,
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // The blank translation is dropped rather than saved as an empty string.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ title: { "en-US": "Hello" } });
    switchTo("fr-FR");
    expect(
      (container.querySelector("#docs-title-fr-FR") as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBeNull();
  });

  test("flags the DEFAULT locale when that is the blank one", async () => {
    const cfg = requiredTitleConfig();
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.docs}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={onSubmit}
        defaultValues={{ title: { "fr-FR": "Salut" } }}
      />,
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => {
      expect(
        (container.querySelector("#docs-title-en-US") as HTMLInputElement).getAttribute(
          "aria-invalid",
        ),
      ).toBe("true");
    });
    expect(container.querySelector("#docs-title-en-US-error")?.textContent).toBe("Required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("shows a validation error only under the locale that failed", async () => {
    // A translation that IS filled still has to satisfy the field's schema, and
    // the message lands under that locale alone.
    const cfg = requiredTitleConfig({ min: 3 });
    const onSubmit = mock();
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.docs}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={onSubmit}
        defaultValues={{ title: { "en-US": "Hello", "fr-FR": "no" } }}
      />,
    );
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    // The default locale is clean; the failing translation is flagged once the
    // switcher brings it on screen.
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
    expect(
      (container.querySelector("#docs-title-en-US") as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBeNull();
    switchTo("fr-FR");
    expect(
      (container.querySelector("#docs-title-fr-FR") as HTMLInputElement).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  test("falls back to the plain widget without a locales prop", () => {
    const { container } = render(
      <CollectionForm collection={config.collections.posts} onSubmit={mock()} />,
    );
    expect(container.querySelector("#posts-title")).not.toBeNull();
    expect(container.querySelector("#posts-title-en-US")).toBeNull();
  });
});

describe("slug derivation from a localized title", () => {
  const stories = defineCollection({
    slug: "stories",
    fields: {
      title: fields.string({ localized: true, required: true }),
      slug: fields.slug({ from: "title" }),
    },
  });
  const cfg = defineConfig({
    branding: { name: "Test" },
    i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
    collections: { stories },
  });

  test("typing the default locale's title fills the slug", () => {
    // The source is a per-locale record, not a string — the case that used to
    // leave the slug empty on every project that translates its titles.
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.stories}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={mock()}
      />,
    );
    fireEvent.change(container.querySelector("#stories-title-en-US") as HTMLInputElement, {
      target: { value: "The Colour of Pomegranates" },
    });
    expect((container.querySelector("#stories-slug") as HTMLInputElement).value).toBe(
      "the-colour-of-pomegranates",
    );
  });

  test("a translation does not overwrite a slug the default locale set", () => {
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.stories}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={mock()}
      />,
    );
    fireEvent.change(container.querySelector("#stories-title-en-US") as HTMLInputElement, {
      target: { value: "Hello World" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /fr-FR/ }));
    fireEvent.change(container.querySelector("#stories-title-fr-FR") as HTMLInputElement, {
      target: { value: "Bonjour Monde" },
    });
    // The default locale still drives the slug, so a French edit doesn't
    // silently change the URL the English page was published at.
    expect((container.querySelector("#stories-slug") as HTMLInputElement).value).toBe(
      "hello-world",
    );
  });

  test("a hand-edited slug is never overwritten by a later title edit", () => {
    const { container } = render(
      <CollectionForm
        collection={cfg.collections.stories}
        locales={LOCALES}
        defaultLocale="en-US"
        onSubmit={mock()}
      />,
    );
    const slug = container.querySelector("#stories-slug") as HTMLInputElement;
    fireEvent.change(slug, { target: { value: "custom-path" } });
    fireEvent.change(container.querySelector("#stories-title-en-US") as HTMLInputElement, {
      target: { value: "Something Else" },
    });
    expect(slug.value).toBe("custom-path");
  });
});
