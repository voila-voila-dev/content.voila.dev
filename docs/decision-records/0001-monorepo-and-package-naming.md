# ADR 0001 — Package naming & repo structure

**Accepted 2026-05-21 · Updated 2026-06-19**

## Decision

**One npm scope, `@voila`.** Naming by role:

| Pattern | Use | Example |
| --- | --- | --- |
| `@voila/<product>` | product runtime entry | `@voila/content` |
| `@voila/<product>-<pkg>` | product sub-package | `@voila/content-ui` |
| `@voila/<pkg>` | cross-product, no prefix | `@voila/ui` |

Product prefix = subdomain (`content.voila.dev` → `content`). Versioning:
Changesets, lock-step across the `@voila/*` packages in each repo.

## Structure (revised)

Originally one monorepo partitioned by `products/<domain>/`. That was **reversed**
in June 2026: each product now lives in its **own repo**, and shared packages were
extracted to their own repos too.

- `content.voila.dev` — `@voila/content`, `-cli`, `-ui`, `-admin`,
  `create-content-voila`
- `ui.voila.dev` — `@voila/ui` (primitives)
- `rich-text-editor.voila.dev` — `@voila/rich-text-editor`

Cross-repo packages are consumed as published npm deps, not workspace links.

**Consequence:** clean ownership boundaries, but cross-repo packages must be
**published** before a consumer repo can install or test. All packages are now
published, so this is no longer a blocker.
