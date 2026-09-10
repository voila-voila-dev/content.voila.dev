// StatusControl. The behaviour worth pinning is the DERIVATION — which field
// the header adopts as "status" with no configuration, and when it declines to
// guess — plus that changing it emits a one-field patch rather than a full doc.

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { StatusControl, statusField } from "./status-control";

afterEach(cleanup);

const withStatus = defineCollection({
  slug: "films",
  fields: {
    title: fields.string(),
    status: fields.enum({ values: { Draft: "draft", "Now showing": "showing" } }),
  },
});

const loneEnum = defineCollection({
  slug: "films",
  fields: {
    title: fields.string(),
    stage: fields.enum({ values: { Early: "early", Late: "late" } }),
  },
});

const twoEnums = defineCollection({
  slug: "films",
  fields: {
    stage: fields.enum({ values: { Early: "early" } }),
    mood: fields.enum({ values: { Warm: "warm" } }),
  },
});

const noEnum = defineCollection({
  slug: "films",
  fields: { title: fields.string() },
});

describe("statusField", () => {
  test("prefers a field actually named status", () => {
    expect(statusField(withStatus)?.name).toBe("status");
  });

  test("adopts a lone enum when nothing is named status", () => {
    expect(statusField(loneEnum)?.name).toBe("stage");
  });

  test("declines to guess between two unnamed enums", () => {
    expect(statusField(twoEnums)).toBeUndefined();
  });

  test("returns nothing for a collection with no enum at all", () => {
    expect(statusField(noEnum)).toBeUndefined();
  });
});

describe("StatusControl", () => {
  test("renders nothing when there is no status field", () => {
    const { container } = render(
      <StatusControl collection={noEnum} doc={{ id: "1" }} onChange={mock()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("shows the current value's human label", () => {
    render(
      <StatusControl
        collection={withStatus}
        doc={{ id: "1", status: "showing" }}
        onChange={mock()}
      />,
    );
    expect(screen.getByText("Now showing")).toBeDefined();
  });

  test("invites a choice when the record has no status yet", () => {
    render(<StatusControl collection={withStatus} doc={{ id: "1" }} onChange={mock()} />);
    expect(screen.getByText("Set status")).toBeDefined();
  });

  test("names the current status for assistive tech", () => {
    render(
      <StatusControl
        collection={withStatus}
        doc={{ id: "1", status: "draft" }}
        onChange={mock()}
      />,
    );
    expect(screen.getByRole("button", { name: "Status: Draft. Change it." })).toBeDefined();
  });

  test("picking a value emits a one-field patch of the STORED value", () => {
    const onChange = mock();
    render(
      <StatusControl
        collection={withStatus}
        doc={{ id: "1", status: "draft" }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Now showing"));
    expect(onChange).toHaveBeenCalledWith({ status: "showing" });
  });

  test("the value already set is not offered again", () => {
    render(
      <StatusControl
        collection={withStatus}
        doc={{ id: "1", status: "draft" }}
        onChange={mock()}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    const items = screen.getAllByRole("menuitem");
    const current = items.find((el) => el.textContent?.includes("Draft"));
    expect(current?.getAttribute("data-disabled")).not.toBeNull();
  });
});
