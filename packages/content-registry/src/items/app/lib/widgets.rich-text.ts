// app/lib/widgets.ts — field widgets for your admin pages, with the Plate-based
// rich-text editor wired in (this file is installed by `voila add
// rich-text-editor`, overwriting the default seam). It layers the rich-text
// input/display over the built-in registries; every other field kind keeps its
// default widget. Own this file — add your own custom widgets to either registry.

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
