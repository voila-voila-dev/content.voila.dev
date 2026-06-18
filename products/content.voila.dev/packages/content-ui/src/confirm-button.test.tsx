import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmButton } from "./confirm-button";

afterEach(cleanup);

describe("ConfirmButton", () => {
  test("does not run the action until the dialog is confirmed", async () => {
    const onConfirm = mock();
    render(
      <ConfirmButton onConfirm={onConfirm} title="Delete post?" description="This can't be undone.">
        Delete
      </ConfirmButton>,
    );
    // Only the trigger exists before it's opened; clicking it opens the dialog
    // (and does NOT run the action).
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();
    // The dialog's prompt is now shown.
    expect(await screen.findByText("Delete post?")).toBeDefined();
    expect(screen.getByText("This can't be undone.")).toBeDefined();
    // The open modal makes the background (including the trigger) inert, so the
    // only "Delete" left in the a11y tree is the confirm action, which reuses
    // the trigger's label. Confirming runs the action.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  test("cancelling closes the dialog without running the action", async () => {
    const onConfirm = mock();
    render(<ConfirmButton onConfirm={onConfirm}>Delete</ConfirmButton>);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Are you sure?")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("uses the trigger's text as the confirm label, overridable", async () => {
    render(
      <ConfirmButton onConfirm={mock()} confirmLabel="Yes, remove it">
        Remove
      </ConfirmButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("button", { name: "Yes, remove it" })).toBeDefined();
  });

  test("disables the trigger when asked", () => {
    render(
      <ConfirmButton onConfirm={mock()} disabled>
        Deleting…
      </ConfirmButton>,
    );
    const trigger = screen.getByRole("button", { name: "Deleting…" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});
