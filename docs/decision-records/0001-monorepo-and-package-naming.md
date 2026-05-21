# ADR 0001 — Monorepo and `@voila` package naming

- **Status**: Accepted
- **Date**: 2026-05-21
- **Deciders**: Emilien
- **Tags**: tooling, repo-structure, npm

## Context

Voila is going to ship more than one product over time. 
`content.voila.dev` is the first; 

Two questions had to be answered before we add the second product:

1. **Repository topology** — one repo for everything, or one repo per product?
2. **npm naming** — what scope and what package names so the convention scales to N products without collision or rename churn?

## Decision

### Monorepo

A single repository, `voila-voila-dev/voila`, hosts every Voila product. The repo is partitioned by product: each product owns its own `apps/`, `packages/`, and `examples/` subtree under `products/<domain>/`. Anything cross-product lives at the repo root.

```
.
├── products/
│   └── content.voila.dev/         # one folder per product (domain-named)
│       ├── apps/                  # runnable apps owned by this product (playground, docs, …)
│       ├── packages/              # @voila/content-* packages
│       ├── examples/              # example consumers for this product
│       └── docs/                  # product-specific design docs (requirements, etc.)
├── packages/                      # cross-product shared packages (no product prefix)
├── docs/
│   └── decision-records/          # ADRs that affect the whole org
├── .changeset/
├── .github/
└── package.json                   # Bun workspaces root
```

Workspaces are managed by Bun. The root `package.json` declares:

```jsonc
"workspaces": [
  "packages/*",
  "products/*/apps/*",
  "products/*/packages/*",
  "products/*/examples/*"
]
```

Versioning across packages is locked with Changesets `fixed` so every package in the `@voila/*` scope ships on the same version.

### npm naming convention

One scope: **`@voila`**.

| Pattern                       | Meaning                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `@voila/<product>`            | The runtime entry point of a product (e.g. `@voila/content`)         |
| `@voila/<product>-<package>`  | A sub-package of a product (e.g. `@voila/content-schema`)            |
| `@voila/<package>`            | Cross-product / shared package, no product prefix                    |

The product prefix matches the subdomain: `content.voila.dev` → `content`, `auth.voila.dev` → `auth`, `billing.voila.dev` → `billing`.

### Concrete remap (existing packages)

| Before                                  | After                       |
| --------------------------------------- | --------------------------- |
| `@content.voila.dev/schema`             | `@voila/content-schema`     |
| `@content.voila.dev/typescript-config`  | `@voila/typescript-config`  |

### Planned namespace (illustrative, not commitments)

```
# content product
@voila/content              # runtime — defineContent + request handler
@voila/content-schema       # field constructors + Standard Schema derivation
@voila/content-db           # Drizzle adapter (D1, Postgres, SQLite)
@voila/content-ui           # admin design system
@voila/content-client       # typed REST client
@voila/content-storage      # R2 / S3 / media pipeline
@voila/content-mcp          # MCP server
@voila/content-cli          # voila CLI

# future products
@voila/auth                 # auth.voila.dev runtime
@voila/auth-server
@voila/billing
@voila/billing-stripe

# cross-product (no product prefix)
@voila/typescript-config
@voila/biome-config
@voila/ui-tokens
@voila/utils
```

### Apps (not published)

Apps live under `products/<domain>/apps/` and keep simple unscoped names with `"private": true`:

```
products/content.voila.dev/apps/playground/package.json
  → { "name": "playground", "private": true }

products/content.voila.dev/apps/docs/package.json
  → { "name": "docs", "private": true }
```

## Alternatives considered

### Multi-repo (one repo per product)

**Rejected** for our scale (1 FTE, multiple products under one brand). Specific reasons:

- Cross-product refactors (e.g. updating `@voila/ui-tokens`) become a publish-bump-install dance across N repos instead of one atomic commit.
- Tooling drifts between repos: Bun version, Biome rules, tsconfig base, lefthook hooks, changeset config — each becomes a thing to keep in sync.
- We lose the ability to import shared packages via workspace symlinks; every dep has to be a published release before another product can use it.
- Changesets, our chosen release tool, is designed around the monorepo model. A per-repo setup means re-inventing version coordination.

The classic monorepo downside (CI cost on large trees) doesn't apply here — we're nowhere near the scale where it bites. Reference points: Vercel, Cloudflare, Shopify, Strapi all ship monorepos far larger than what we'll build.

### Per-product npm org / scope

**Rejected.** Would mean registering `@voila-content`, `@voila-auth`, `@voila-billing` as separate npm orgs (npm orgs are paid above the free tier, and management overhead scales linearly). It also fragments the search story — `npm search @voila/` no longer lists everything in one shot.

### Dotted scope `@content.voila.dev/*`

**Rejected — and required to be migrated away from.** npm rejects dots in scope names. The packages currently using this scope can't actually publish.

### TanStack-style: one repo per major product (`tanstack/router`, `tanstack/query`)

**Rejected.** TanStack's products are largely independent libraries with their own maintainer subteams. Our products share design tokens, validators, auth primitives, infrastructure — they're more like Vercel's product family (`@vercel/*` monorepo) than independent libraries.

## Consequences

### Positive

- One outlet for tooling fixes — when we improve the build pipeline, every product benefits at the next commit.
- Workspace-linked deps mean inner-loop changes (edit `@voila/ui-tokens`, see effect in `@voila/content` admin) are instant. No `npm publish` involved.
- A single `@voila` org on npm scales to every future product with no admin overhead.
- Changesets `fixed` keeps the version story trivial: every package in the scope ships at the same version. "What version are we on?" is answerable by looking at any `package.json`.

### Negative / risks

- CI runs every check on every push. Mitigation comes later via path-filtered workflows or Turborepo-style task graphs once the repo grows.
- A single security advisory (e.g. one package gets vulnerability-flagged) tarnishes the whole `@voila` namespace's view. Acceptable price.

### Required follow-up

1. Move content-specific subtrees into `products/content.voila.dev/`: existing `packages/schema/`, the placeholder `apps/`, `examples/`, and `docs/requirements/`.
2. Keep cross-product code at the root: `packages/typescript-config/` stays; `docs/decision-records/` stays.
3. Rename `@content.voila.dev/schema` → `@voila/content-schema` in `products/content.voila.dev/packages/schema/package.json`.
4. Rename `@content.voila.dev/typescript-config` → `@voila/typescript-config` in `packages/typescript-config/package.json` and every `extends`/`devDependencies` reference.
5. Update the root `package.json` `workspaces` to the nested globs documented above.
6. Update `.changeset/config.json` `fixed` glob from `@content.voila.dev/*` to `@voila/*`, and the `changelog` `repo` to `voila-voila-dev/voila`.
7. Update `12-roadmap.md` and any other doc that references the old scope or layout.
8. Bump the version (Changesets will treat it as a normal release; the rename itself does not need a major bump pre-1.0).
9. Rename the GitHub repo `content.voila.dev` → `voila`.

## References

- [Standard Schema](https://standardschema.dev/) — referenced in [04 — Schema & Fields](../../products/content.voila.dev/docs/requirements/04-schema-and-fields.md#validator-library).
- [Changesets docs — `fixed`](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#fixed-array-of-arrays-of-package-names).
- [npm package naming rules](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name).
