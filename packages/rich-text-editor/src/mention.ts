import { MentionPlugin } from "@platejs/mention/react";

export interface MentionOptions {
  /**
   * Which collection the mention resolves against (e.g. `"users"`). Stored on
   * the plugin so a host app's combobox/render layer knows what to query.
   */
  source: string;
  /** Character that opens the mention combobox. Defaults to `"@"`. */
  trigger?: string;
}

/**
 * Configures the Plate mention plugin for cross-references. Append it to the
 * editor's plugin list:
 *
 * ```ts
 * import { mention } from "@voila/rich-text/mention";
 * usePlateEditor({ plugins: [...basicPlugins, mention({ source: "users" })] });
 * ```
 */
export function mention(options: MentionOptions) {
  return MentionPlugin.extend({
    options: {
      trigger: options.trigger ?? "@",
      source: options.source,
    },
  });
}
