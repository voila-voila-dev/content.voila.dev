# ADR 0001 — Monorepo and `@voila` package naming

**Accepted · 2026-05-21**

## Context

Voila will ship more than one product (`content.voila.dev` is the first). Two questions to settle before product number two:

1. One repo for everything, or one per product?
2. What npm scope + naming convention scales to N products?

## Decisions

### Monorepo, partitioned by product

Single repo `voila-voila-dev/voila.dev`. Each product owns its subtree under `products/<domain>/`. Cross-product code lives at the root.

```
.
├── products/
│   └── content.voila.dev/
│       ├── apps/                  # playground, docs, …
│       ├── packages/              # @voila/content-* packages
│       ├── examples/
│       └── docs/                  # product-specific design docs
├── packages/                      # cross-product, no product prefix
├── docs/decision-records/         # org-wide ADRs
└── package.json                   # Bun workspaces root
```

Root `package.json`:

```jsonc
"workspaces": [
  "packages/*",
  "products/*/apps/*",
  "products/*/packages/*",
  "products/*/examples/*"
]
```

Versioning: Changesets `fixed: [["@voila/*"]]` — every package in scope ships on the same version.

### npm naming

One scope: **`@voila`**.

| Pattern                       | Use                                                |
| ----------------------------- | -------------------------------------------------- |
| `@voila/<product>`            | Product runtime entry (e.g. `@voila/content`)      |
| `@voila/<product>-<package>`  | Product sub-package (e.g. `@voila/content-schema`) |
| `@voila/<package>`            | Cross-product, no product prefix                   |

Product prefix = subdomain: `content.voila.dev` → `content`, `auth.voila.dev` → `auth`.

Apps under `products/<domain>/apps/` are unpublished — unscoped name + `"private": true`.

### Existing packages renamed

| Before                                  | After                       |
| --------------------------------------- | --------------------------- |
| `@content.voila.dev/schema`             | `@voila/content-schema`     |
| `@content.voila.dev/typescript-config`  | `@voila/typescript-config`  |
