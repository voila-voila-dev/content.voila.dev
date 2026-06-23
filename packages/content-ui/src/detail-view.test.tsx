import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { DetailView, documentTitle } from "./detail-view";

afterEach(cleanup);

const posts = defineCollection({
  slug: "posts",
  label: "Blog Post",
  fields: {
    title: fields.string(),
    views: fields.number({ label: "View Count" }),
    published: fields.boolean(),
    secret: fields.string({ hidden: true }),
  },
});

const doc = { id: "1", title: "Hello", views: 1200, published: true, secret: "shh" };

describe("DetailView", () => {
  test("renders a term + value per non-hidden field, skipping hidden", () => {
    const { container } = render(<DetailView collection={posts} doc={doc} />);
    const terms = Array.from(container.querySelectorAll("dt")).map((d) => d.textContent);
    expect(terms).toEqual(["Title", "View Count", "Published"]);
    expect(terms).not.toContain("Secret");
  });

  test("renders each value through the widget registry", () => {
    render(<DetailView collection={posts} doc={doc} />);
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText((1200).toLocaleString())).toBeDefined();
    expect(screen.getByText("Yes")).toBeDefined();
  });

  test("explicit fields render in order and may include hidden ones", () => {
    const { container } = render(
      <DetailView collection={posts} doc={doc} fields={["secret", "title"]} />,
    );
    const terms = Array.from(container.querySelectorAll("dt")).map((d) => d.textContent);
    expect(terms).toEqual(["Secret", "Title"]);
  });

  test("ignores unknown field keys", () => {
    const { container } = render(
      <DetailView collection={posts} doc={doc} fields={["title", "nope"]} />,
    );
    expect(Array.from(container.querySelectorAll("dt")).map((d) => d.textContent)).toEqual([
      "Title",
    ]);
  });

  test("titles with the collection label by default", () => {
    render(<DetailView collection={posts} doc={doc} />);
    expect(screen.getByRole("heading", { name: "Blog Post" })).toBeDefined();
  });

  test("titles with the document's titleField value when the collection declares one", () => {
    const titled = defineCollection({ ...posts, titleField: "title" });
    render(<DetailView collection={titled} doc={doc} />);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeDefined();
  });

  test("falls back to the collection label when the titleField value is blank", () => {
    const titled = defineCollection({ ...posts, titleField: "title" });
    render(<DetailView collection={titled} doc={{ ...doc, title: "   " }} />);
    expect(screen.getByRole("heading", { name: "Blog Post" })).toBeDefined();
  });

  test("an explicit title and actions render in the header", () => {
    render(
      <DetailView
        collection={posts}
        doc={doc}
        title="Hello"
        actions={<button type="button">Edit</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Hello" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
  });

  test("missing values render their empty placeholder", () => {
    const { container } = render(
      <DetailView collection={posts} doc={{ id: "2", title: "Only title" }} />,
    );
    const definitions = container.querySelectorAll("dd");
    // title present, views/published empty → em-dash placeholders.
    expect(within(definitions[0] as HTMLElement).getByText("Only title")).toBeDefined();
    expect((definitions[1] as HTMLElement).textContent).toBe("—");
  });

  test("shows a loading state when there's no doc yet", () => {
    const { container } = render(<DetailView collection={posts} loading />);
    // No definition list while loading...
    expect(container.querySelector("dl")).toBeNull();
    // ...and the loading text appears (visible + in the aria-live region).
    expect(screen.getAllByText("Loading…").length).toBeGreaterThan(0);
  });

  test("shows the not-found state when there's no doc and not loading", () => {
    render(<DetailView collection={posts} emptyMessage="No such post" />);
    expect(screen.getAllByText("No such post").length).toBeGreaterThan(0);
  });

  test("defaults the empty state to 'Not found.'", () => {
    render(<DetailView collection={posts} doc={null} />);
    expect(screen.getAllByText("Not found.").length).toBeGreaterThan(0);
  });

  test("shows an error as an alert", () => {
    render(<DetailView collection={posts} error="Boom" />);
    expect(screen.getByRole("alert").textContent).toBe("Boom");
  });

  test("hides actions while there's no doc", () => {
    render(<DetailView collection={posts} loading actions={<button type="button">Edit</button>} />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  test("the page heading is programmatically focusable", () => {
    render(<DetailView collection={posts} doc={doc} />);
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("tabindex")).toBe("-1");
  });
});

describe("documentTitle", () => {
  const titled = defineCollection({ ...posts, titleField: "views" });

  test("returns undefined without a titleField", () => {
    expect(documentTitle(posts, doc)).toBeUndefined();
  });

  test("stringifies a numeric title value", () => {
    expect(documentTitle(titled, doc)).toBe("1200");
  });

  test("returns undefined for a missing or non-scalar value", () => {
    expect(documentTitle(titled, { views: undefined })).toBeUndefined();
    expect(documentTitle(titled, { views: { nested: true } })).toBeUndefined();
  });
});
