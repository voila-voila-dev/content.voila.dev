---
"@voila/content": minor
"@voila/content-ui": minor
"@voila/content-admin": patch
---

`defineCollection` / `defineSingleton` accept `order`, the entity's position in the admin sidebar and dashboard (ascending; unordered entities keep declaration order after them, so a singleton can lead its group). A host `branding.logo` now fills the sidebar and login marks instead of sitting on the initial's tint.
