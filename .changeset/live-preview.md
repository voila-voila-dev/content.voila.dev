---
"@voila/content-admin": minor
"@voila/content-ui": minor
---

Live preview. `defineAdmin({ preview: { pages: { url: (doc) => "/preview/pages" } } })`
splits a document's detail and edit screens into the form and an iframe on the
site's own preview route, fed the document over `postMessage` as it is edited —
unsaved values included. The frame announces itself (`voila:preview:listening`),
receives `{ type: "voila:preview", doc, seq, focus? }` and answers
`voila:preview:ready`; the admin never lets the frame read drafts. Resizable,
remembered per slug, desktop only. `content-ui` gains `PreviewPane` /
`usePreviewChannel`, `CollectionForm`'s `onValuesChange` and `onFocusPathChange`
(the path of the expanded block or array row, via `FocusPathProvider`), and
`useMediaQuery`.
