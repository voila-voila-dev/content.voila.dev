import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import {
  DisplayRegistryProvider,
  EditRegistryProvider,
  useDisplayRegistry,
  useEditRegistry,
} from "./context";
import { defaultEditRegistry, mergeEditRegistry } from "./edit";
import { defaultDisplayRegistry, mergeDisplayRegistry } from "./registry";

afterEach(cleanup);

describe("registry contexts", () => {
  test("default to the built-in registries outside a provider", () => {
    let edit: unknown;
    let display: unknown;
    function Probe() {
      edit = useEditRegistry();
      display = useDisplayRegistry();
      return null;
    }
    render(<Probe />);
    expect(edit).toBe(defaultEditRegistry);
    expect(display).toBe(defaultDisplayRegistry);
  });

  test("provide the given registries downward", () => {
    const Custom = () => null;
    const edit = mergeEditRegistry({ string: Custom });
    const display = mergeDisplayRegistry({ string: Custom });
    let seenEdit: unknown;
    let seenDisplay: unknown;
    function Probe() {
      seenEdit = useEditRegistry();
      seenDisplay = useDisplayRegistry();
      return null;
    }
    render(
      <EditRegistryProvider registry={edit}>
        <DisplayRegistryProvider registry={display}>
          <Probe />
        </DisplayRegistryProvider>
      </EditRegistryProvider>,
    );
    expect(seenEdit).toBe(edit);
    expect(seenDisplay).toBe(display);
  });
});
