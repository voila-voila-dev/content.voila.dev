// app/lib/widgets.ts — the single place the admin pages get their field widgets
// from. Pass `editWidgets` to `CollectionForm` (write) and `displayWidgets` to
// `ListView` / `DetailView` / `DataTable` (read). This is the rich-text-flavored
// seam (the Plate editor wired in for `richText` + `markdown`); own this file —
// add your own custom widgets to either registry.

import { mergeDisplayRegistry, mergeEditRegistry } from "@voila/content-ui";
import { RichTextInput } from "../components/widgets/rich-text";
import { RichTextDisplay } from "../components/widgets/rich-text-display";

/** Edit widgets for `CollectionForm` — `richText` and `markdown` use the Plate
 *  editor (markdown stays one toggle away from its raw source). */
export const editWidgets = mergeEditRegistry({
  richText: RichTextInput,
  markdown: RichTextInput,
});

/** Display widgets for `ListView` / `DetailView` — `richText` renders formatted. */
export const displayWidgets = mergeDisplayRegistry({ richText: RichTextDisplay });
