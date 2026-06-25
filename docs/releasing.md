# Releasing

The `@voila/content*` packages publish from source (`exports` point at `src/`,
no build step). They use bun's `workspace:` and `catalog:` dependency protocols,
which **npm cannot resolve on install** — so the publish step must rewrite them
to concrete versions first.

## Steps

```sh
# 1. Author a changeset describing the change (one per PR).
bun run changeset

# 2. Version: bump packages + write changelogs from the pending changesets.
bun run version            # = changeset version

# 3. Review the version bumps, commit, then publish.
bun run release:dry        # preview: shows the resolved manifests, publishes nothing
bun run release            # = bun scripts/publish
```

`bun run release` runs [`scripts/publish`](../scripts/publish/index.ts): for each
public, not-yet-published package it resolves `workspace:*` → the sibling's
version and `catalog:` → the root `workspaces.catalog` value, `npm publish`es,
then restores the source `package.json` (the working tree keeps the protocols).
It publishes in dependency order, skips versions already on npm, and aborts on an
unexpected major jump unless `--allow-major`.

## Do not use `changeset publish`

`changeset publish` (npm under the hood) ships the **literal** `workspace:` /
`catalog:` specs in the published manifests, producing uninstallable packages
(this is how the 0.2.0 / 0.1.3 publish broke and had to be re-released as
0.2.1 / 0.1.4). `bun run release` exists precisely to avoid that.

## Notes

- The `@voila/*` publishable packages are a `fixed` changeset group (they version
  together). The group is listed explicitly in `.changeset/config.json` rather
  than via a `@voila/*` glob, because the glob also matched the private
  `@voila/demo.content.voila.dev` app (no `version`) and crashed `changeset`.
- `@voila/content-ui` is a regular **dependency** of `@voila/content-admin`
  (content-admin renders content-ui's screens — it is not optional). It was
  previously an optional peer, which made `changeset version` wrongly escalate
  content-admin to a *major* on any content-ui bump.
- 2FA: if your npm account requires an OTP for writes, `npm publish` will prompt;
  run `bun run release` interactively or pass the OTP via npm config.
