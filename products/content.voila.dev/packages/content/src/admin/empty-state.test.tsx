import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "./empty-state.tsx";

describe("EmptyState", () => {
  test("renders title + description", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No records yet" description="Empty for now." />,
    );
    expect(html).toContain("No records yet");
    expect(html).toContain("Empty for now.");
  });

  test("renders an optional action node", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Empty" action={<button type="button">Create</button>} />,
    );
    expect(html).toContain("Create");
  });
});
