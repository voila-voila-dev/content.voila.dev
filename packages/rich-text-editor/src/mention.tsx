// @-mention support: an inline, atomic reference to a record in some source
// collection (a user, a tag, another post). Typing `@` opens the shared
// `InlineCombobox` over a caller-supplied item list; selecting one inserts a
// `mention` element whose shape matches the engine's `mention()` field schema
// (`source` / `value` / `label`), so it round-trips through the wire adapter and
// validates on write.
//
// The mention element is inline + void (Plate renders its `[{text:""}]` child as
// an empty leaf, and we render the label as decoration). The source data lives
// in the host app, so `mentionPlugins({ source, items })` takes the items to
// offer — the editor itself stays data-agnostic.

import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";
import type { AnyPlatePlugin, PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useReadOnly, useSelected } from "platejs/react";
import type { ReactNode } from "react";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./combobox.tsx";

/** Plate node key for the inserted mention (matches the engine wire type). */
export const MENTION_KEY = MentionPlugin.key;
/** Plate node key for the in-progress `@…` input. */
export const MENTION_INPUT_KEY = MentionInputPlugin.key;

/** One option in the mention combobox. */
export interface MentionItem {
  /** Stored on the mention as `value` — the referenced record's id/key. */
  readonly value: string;
  /** Shown inline and stored as `label`; also the default search term. */
  readonly label: string;
  /** Extra search terms. */
  readonly keywords?: ReadonlyArray<string>;
}

export interface MentionOptions {
  /** Source collection slug (e.g. `"users"`); stored on each mention node. */
  source: string;
  /** The selectable records. The combobox filters this list as the user types. */
  items: ReadonlyArray<MentionItem>;
  /** Character that opens the combobox. Defaults to `"@"`. */
  trigger?: string;
}

/**
 * Configures just the {@link MentionPlugin} (no input UI) — kept for callers who
 * assemble their own plugin list. Prefer {@link mentionPlugins} for the full,
 * wired-up editor experience.
 */
export function mention(options: Pick<MentionOptions, "source" | "trigger">) {
  return MentionPlugin.extend({
    options: { trigger: options.trigger ?? "@", source: options.source },
  });
}

/** Renders an inserted mention inline as `@label`, with a selection ring. */
function MentionElement(props: PlateElementProps): ReactNode {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();
  const label = (element.label as string | undefined) ?? (element.value as string);
  return (
    <PlateElement
      {...props}
      className="voila-rich-text-mention"
      attributes={{
        ...props.attributes,
        "data-slate-value": element.value as string,
        contentEditable: false,
        "data-selected": selected && focused && !readOnly ? "true" : undefined,
      }}
    >
      @{label}
      {props.children}
    </PlateElement>
  );
}

/** Builds the `mention_input` node component bound to a source's items. */
function makeMentionInputElement(options: MentionOptions) {
  const trigger = options.trigger ?? "@";
  return function MentionInputElement(props: PlateElementProps): ReactNode {
    const { editor, element } = props;
    return (
      <PlateElement {...props} as="span" data-slate-value={element.value}>
        <InlineCombobox element={element} trigger={trigger}>
          <InlineComboboxInput aria-label="Mention" />
          <InlineComboboxContent>
            <InlineComboboxEmpty>No matches</InlineComboboxEmpty>
            {options.items.map((item) => (
              <InlineComboboxItem
                key={item.value}
                value={item.label}
                keywords={item.keywords ? [...item.keywords] : undefined}
                onClick={() => {
                  // The shared chrome already removed the input and restored the
                  // selection; insert a schema-shaped mention node in its place.
                  editor.tf.insertNodes({
                    type: MENTION_KEY,
                    source: options.source,
                    value: item.value,
                    label: item.label,
                    children: [{ text: "" }],
                  });
                  editor.tf.insertText(" ");
                }}
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

export interface MentionPluginConfig {
  readonly plugins: ReadonlyArray<AnyPlatePlugin>;
  readonly components: Record<string, (props: PlateElementProps) => ReactNode>;
}

/**
 * The plugins + component map that power @-mentions for a source. Register the
 * plugins on the editor and merge the components into its `components` map — or
 * just pass `{ mention: { source, items } }` to `derivePlugins`, which does both.
 */
export function mentionPlugins(options: MentionOptions): MentionPluginConfig {
  const inputComponent = makeMentionInputElement(options);
  return {
    plugins: [
      mention(options) as unknown as AnyPlatePlugin,
      MentionInputPlugin.withComponent(inputComponent) as unknown as AnyPlatePlugin,
    ],
    components: {
      [MENTION_KEY]: MentionElement,
      [MENTION_INPUT_KEY]: inputComponent,
    },
  };
}
