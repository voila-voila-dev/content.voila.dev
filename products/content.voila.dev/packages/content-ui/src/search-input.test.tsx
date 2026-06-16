import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SearchInput } from "./search-input";

afterEach(cleanup);

describe("SearchInput", () => {
  test("renders a labelled search box with the current value", () => {
    render(<SearchInput value="fox" onChange={() => {}} />);
    const input = screen.getByRole("searchbox", { name: "Search" }) as HTMLInputElement;
    expect(input.value).toBe("fox");
  });

  test("typing reports each keystroke", () => {
    const onChange = mock();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cat" } });
    expect(onChange).toHaveBeenCalledWith("cat");
  });

  test("submitting the form fires onSubmit with the value (no page reload)", () => {
    const onSubmit = mock();
    render(<SearchInput value="dog" onChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledWith("dog");
  });

  test("disabled blocks input", () => {
    render(<SearchInput value="" onChange={() => {}} disabled />);
    expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
  });
});
