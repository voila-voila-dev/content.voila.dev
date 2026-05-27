# playground.content.voila.dev

The canary app for the Effect rebuild. **Reset to a placeholder** — to be
scaffolded fresh as the first task of M0 (see
[../../docs/pivot/roadmap-effect.md](../../docs/pivot/roadmap-effect.md)):

```bash
bunx --bun @tanstack/cli@latest create playground.content.voila.dev \
  --framework React --deployment cloudflare \
  --target-dir products/content.voila.dev/apps/playground.content.voila.dev
```

Then `voila add admin-shell` vends the real admin route files (no virtual
routes), wired to the Effect engine via the thin server mount. See the
[Effect Architecture Canon](../../docs/pivot/effect-architecture-canon.md).
