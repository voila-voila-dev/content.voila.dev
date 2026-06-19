// app/lib/widgets.ts — the single place your admin pages get their field widgets
// from. Pass `editWidgets` to `CollectionForm` (write) and `displayWidgets` to
// `ListView` / `DetailView` / `DataTable` (read). Owning this one indirection
// means a widget registry item (e.g. `voila add rich-text-editor`) can drop a
// new widget into every page by overwriting this file — no edits to your routes.
// Add your own custom widgets to either registry here.

import { defaultDisplayRegistry, defaultEditRegistry } from "@voila/content-ui";

// `media` fields display out of the box (the default registry renders a
// thumbnail). To make them *editable*, wire the upload-backed widget — it just
// needs your `mediaClient`:
//
//   import { createMediaInput, mergeEditRegistry } from "@voila/content-ui";
//   import { mediaClient } from "./content-client";
//   export const editWidgets = mergeEditRegistry({
//     media: createMediaInput({ upload: (file, opts) => mediaClient.upload(file, opts) }),
//   });

/** Edit widgets for `CollectionForm`. */
export const editWidgets = defaultEditRegistry;

/** Display widgets for `ListView` / `DetailView` / `DataTable`. */
export const displayWidgets = defaultDisplayRegistry;
