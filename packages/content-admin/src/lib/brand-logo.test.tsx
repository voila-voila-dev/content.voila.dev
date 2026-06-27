import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { resolveBrandLogo } from "./brand-logo";

afterEach(cleanup);

describe("resolveBrandLogo", () => {
  test("returns null when there is no logo", () => {
    expect(resolveBrandLogo(undefined)).toBeNull();
  });

  test("wraps a string src in a decorative <img>", () => {
    render(<div>{resolveBrandLogo("/logo.png")}</div>);
    const img = screen.getByRole("presentation");
    expect(img.getAttribute("src")).toBe("/logo.png");
    expect(img.getAttribute("alt")).toBe("");
  });

  test("passes a ReactNode through unchanged", () => {
    const node = <span data-testid="custom-logo">Logo</span>;
    const resolved = resolveBrandLogo(node);
    expect(isValidElement(resolved)).toBe(true);
    render(<div>{resolved}</div>);
    expect(screen.getByTestId("custom-logo")).toBeDefined();
  });
});
