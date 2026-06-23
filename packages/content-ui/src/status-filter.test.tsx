import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StatusFilter } from "./status-filter";

afterEach(cleanup);

describe("StatusFilter", () => {
  test("renders the four publish-state options with the value selected", () => {
    render(<StatusFilter value="published" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All", "Published", "Scheduled", "Drafts"]);
    expect(screen.getByRole("tab", { name: "Published" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  test("selecting an option reports the engine DraftFilter value", () => {
    const onChange = mock();
    render(<StatusFilter value="any" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Scheduled" }));
    expect(onChange).toHaveBeenCalledWith("scheduled");
  });

  test("disabled options don't fire", () => {
    const onChange = mock();
    render(<StatusFilter value="any" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("tab", { name: "Drafts" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
