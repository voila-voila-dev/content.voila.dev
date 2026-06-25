---
"@voila/content-ui": minor
---

`ViewSwitcher` can now **set a saved view as the default** and **rename** it —
new `activeIsDefault` / `onSetDefault` / `onRename` props. The config-driven
admin wires both through the views client (`update({ isDefault })` /
`update({ name })`). This closes the loop on saved views: the list already
auto-loads a user's default view, but until now a default could only be set via
the API, never from the UI.
