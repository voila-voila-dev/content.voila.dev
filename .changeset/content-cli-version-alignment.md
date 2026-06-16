---
"@voila/content-cli": patch
---

Align `@voila/content-cli` with the rest of the workspace at `0.1.0` and make
it publishable (it was `0.0.0` and `private`). The `create-voila` template
pins `@voila/content-cli@^0.1.0`, so the stale `0.0.0` broke workspace
linking and `bun install` in a fresh scaffold died with an npm 404.
