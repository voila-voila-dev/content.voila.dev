import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RevisionHistory } from "./revision-history";

afterEach(cleanup);

const NOW = 1_000_000;

const history = [
  {
    rev: 3,
    createdAt: NOW - 100,
    doc: { title: "v3", status: "published", publishedAt: NOW - 100 },
  },
  { rev: 2, createdAt: NOW - 200, doc: { title: "v2", status: "draft", publishedAt: null } },
  { rev: 1, createdAt: NOW - 300, doc: { title: "v1", status: "draft", publishedAt: null } },
];

describe("RevisionHistory", () => {
  test("renders one row per revision, newest marked Current", () => {
    render(<RevisionHistory revisions={history} now={NOW} />);
    expect(screen.getByText("Revision 3")).toBeDefined();
    expect(screen.getByText("Revision 2")).toBeDefined();
    expect(screen.getByText("Revision 1")).toBeDefined();
    expect(screen.getByText("Current")).toBeDefined();
    // Snapshot status badges render from each revision's doc.
    expect(screen.getByText("Published")).toBeDefined();
    expect(screen.getAllByText("Draft")).toHaveLength(2);
  });

  test("Restore fires on past revisions only, with the revision number", () => {
    const onRestore = mock();
    render(<RevisionHistory revisions={history} onRestore={onRestore} now={NOW} />);
    const buttons = screen.getAllByRole("button", { name: "Restore" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    expect(onRestore).toHaveBeenCalledWith(1);
  });

  test("without onRestore the history is read-only", () => {
    render(<RevisionHistory revisions={history} now={NOW} />);
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  test("disabled prevents restoring", () => {
    const onRestore = mock();
    render(<RevisionHistory revisions={history} onRestore={onRestore} disabled now={NOW} />);
    const button = screen.getAllByRole("button", { name: "Restore" })[0] as HTMLElement;
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onRestore).not.toHaveBeenCalled();
  });

  test("empty history shows the empty message", () => {
    render(<RevisionHistory revisions={[]} emptyMessage="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeDefined();
  });

  test("loading suppresses the empty message and shows the indicator", () => {
    render(<RevisionHistory revisions={[]} loading />);
    expect(screen.queryByText("No revisions yet.")).toBeNull();
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  test("error renders as an alert", () => {
    render(<RevisionHistory revisions={[]} error="Fetch failed" />);
    expect(screen.getByRole("alert").textContent).toBe("Fetch failed");
  });

  test("Load more renders only with a cursor and a handler, and fires it", () => {
    const onLoadMore = mock();
    const { rerender } = render(<RevisionHistory revisions={history} nextCursor="1" />);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();

    rerender(<RevisionHistory revisions={history} nextCursor="1" onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
