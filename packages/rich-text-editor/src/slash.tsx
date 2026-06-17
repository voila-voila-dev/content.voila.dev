// The slash command menu: type `/` to open a capability-gated list of block
// types and turn the current block into the chosen one. It reuses the shared
// `InlineCombobox` chrome and is driven by the same `ToolbarModel` the toolbars
// use, so the menu offers exactly the blocks/lists the field allows — nothing
// the writer couldn't persist.
//
// `slashPlugins(model)` returns the two plugins to register (`SlashPlugin` opens
// the menu on `/`; `SlashInputPlugin` renders the inline input + combobox). Wire
// them via `derivePlugins(elements, marks, { slash: true })`.

import { toggleBulletedList, toggleNumberedList } from "@platejs/list-classic";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import type { PlateEditor, PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import type { ReactNode } from "react";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./combobox.tsx";
import type { ToolbarControl, ToolbarModel } from "./content/capabilities.ts";

/** A single slash command, resolved from the field's allowed block/list kinds. */
export interface SlashItem extends ToolbarControl {}

/**
 * Flattens a {@link ToolbarModel} into the slash menu's item list: block
 * turn-into commands followed by list commands (marks aren't block commands and
 * are left to the toolbar). Empty when the field allows no blocks/lists.
 */
export function deriveSlashItems(model: ToolbarModel): ReadonlyArray<SlashItem> {
  return [...model.blocks, ...model.lists];
}

/** Applies a slash command to the current block (same transforms as the toolbar). */
function applySlashItem(editor: PlateEditor, item: SlashItem): void {
  if (item.control === "list") {
    if (item.plateKey === "ol") toggleNumberedList(editor);
    else toggleBulletedList(editor);
    return;
  }
  editor.tf.toggleBlock(item.plateKey);
}

/**
 * Builds the `slash_input` node component bound to a field's commands. Each
 * `InlineComboboxItem` removes the slash input on click (via the shared chrome),
 * then this `onClick` turns the block into the chosen kind.
 */
function makeSlashInputElement(items: ReadonlyArray<SlashItem>) {
  return function SlashInputElement(props: PlateElementProps): ReactNode {
    const { editor, element } = props;
    return (
      <PlateElement {...props} as="span" data-slate-value={element.value}>
        <InlineCombobox element={element} trigger="/">
          <InlineComboboxInput aria-label="Insert block" />
          <InlineComboboxContent>
            <InlineComboboxEmpty>No matching blocks</InlineComboboxEmpty>
            {items.map((item) => (
              <InlineComboboxItem
                key={`${item.control}:${item.wireType}`}
                value={item.label}
                onClick={() => applySlashItem(editor, item)}
              >
                {item.label}
              </InlineComboboxItem>
            ))}
          </InlineComboboxContent>
        </InlineCombobox>
        {props.children}
      </PlateElement>
    );
  };
}

/** The Plate key the slash input renders under (the component-map key). */
export const SLASH_INPUT_KEY = SlashInputPlugin.key;

export interface SlashPluginConfig {
  /** Plugins to register: the trigger plugin + the input plugin with its UI. */
  readonly plugins: ReadonlyArray<ReturnType<typeof SlashInputPlugin.withComponent>>;
  /** The `slash_input` node component, for the editor's `components` map. */
  readonly component: ReturnType<typeof makeSlashInputElement>;
}

/**
 * The plugins + component that power the slash menu for the given field model.
 * Returns nothing meaningful when the field has no block/list commands — callers
 * (`derivePlugins`) skip wiring it then.
 */
export function slashPlugins(model: ToolbarModel): SlashPluginConfig {
  const items = deriveSlashItems(model);
  const component = makeSlashInputElement(items);
  return {
    plugins: [SlashPlugin, SlashInputPlugin.withComponent(component)] as never,
    component,
  };
}
