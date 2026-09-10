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

  test("falls back to a logo uploaded into content", () => {
    render(<div>{resolveBrandLogo(undefined, "/uploads/mark.png")}</div>);
    expect(screen.getByRole("presentation").getAttribute("src")).toBe("/uploads/mark.png");
  });

  test("a configured logo outranks the one in content", () => {
    // A site that ships a mark in `defineAdmin` keeps it; the settings singleton
    // is the fallback for projects that never configured one.
    render(<div>{resolveBrandLogo("/config.svg", "/uploads/mark.png")}</div>);
    expect(screen.getByRole("presentation").getAttribute("src")).toBe("/config.svg");
  });

  test("still returns null when neither is set", () => {
    // The sidebar and login page draw their initial-letter mark from null.
    expect(resolveBrandLogo(undefined, undefined)).toBeNull();
  });
});
