import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublishControls } from "./publish-controls";

afterEach(cleanup);

const NOW = 1_000_000;

describe("PublishControls", () => {
  test("renders nothing for a non-draft document", () => {
    const { container } = render(
      <PublishControls doc={{ id: "1" }} onPublish={() => {}} onUnpublish={() => {}} now={NOW} />,
    );
    expect(container.textContent).toBe("");
  });

  test("a draft shows Publish and fires onPublish", () => {
    const onPublish = mock();
    render(
      <PublishControls
        doc={{ status: "draft", publishedAt: null }}
        onPublish={onPublish}
        onUnpublish={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText("Draft")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  test("a live document shows Unpublish and fires onUnpublish", () => {
    const onUnpublish = mock();
    render(
      <PublishControls
        doc={{ status: "published", publishedAt: NOW - 1 }}
        onPublish={() => {}}
        onUnpublish={onUnpublish}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });

  test("a scheduled document also shows Unpublish", () => {
    render(
      <PublishControls
        doc={{ status: "published", publishedAt: NOW + 1000 }}
        onPublish={() => {}}
        onUnpublish={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText("Scheduled")).toBeDefined();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeDefined();
  });

  test("disabled prevents the action", () => {
    const onPublish = mock();
    render(
      <PublishControls
        doc={{ status: "draft" }}
        onPublish={onPublish}
        onUnpublish={() => {}}
        disabled
        now={NOW}
      />,
    );
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onPublish).not.toHaveBeenCalled();
  });
});
