# 11 — Deployment

The reference target is **Cloudflare**. Everything works elsewhere, but Cloudflare is the happy path.

## Cloudflare

Required bindings (auto-suggested by `voila init`):

```jsonc
// wrangler.jsonc
{
  "name": "my-site",
  "main": ".output/server/index.mjs",
  "compatibility_date": "2026-05-01",
  "compatibility_flags": ["nodejs_compat"],

  "d1_databases": [
    {
      "binding": "DATABASE",
      "database_name": "my-site",
      "database_id": "…"
    }
  ],

  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "my-site-media"
    }
  ],

  "queues": {
    "producers": [
      {
        "binding": "QUEUE",
        "queue": "my-site-tasks"
      }
    ],
    "consumers": [
      {
        "queue": "my-site-tasks",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  },

  "triggers": {
    "crons": ["* * * * *"]   // populated by `voila migrate`
  },

  "vars": {
    "VOILA_AUTH_SECRET": "…"   // signs Better Auth sessions / tokens
  }
}
```

The TanStack Start Cloudflare adapter handles the rest:

```bash
bun run build              # vite build with the cloudflare preset
bunx wrangler deploy       # one-shot deploy
```

Or via Vercel/Netlify-style git-push deploy if you wire it up.

### D1 migrations

```bash
bunx voila migrate         # generate + apply locally
bunx voila migrate --remote # apply against the deployed D1 (wraps wrangler d1 migrations apply)
```

Migrations live in `migrations/` at the project root, committed to git. Reviewable in PRs.

### Cron triggers

`voila migrate` writes your cron entries into `wrangler.jsonc` under `triggers.crons`. The deployed worker exports a `scheduled()` handler that dispatches to the registered jobs.

### Queues

Background tasks land on Cloudflare Queues. The same worker is also the consumer. Failures retry per the task's `retry` policy; permanent failures land on a dead-letter queue and surface in the admin's **Tasks** page.

### Durable Objects (optional)

If `live` features are enabled (live preview, presence, collaborative editing), a single Durable Object class `VoilaRoom` is registered. Otherwise no DOs needed.

---

## Other runtimes

`@voila/content` is platform-agnostic at the handler level. The catch-all route uses the standard `Request`/`Response` Web API.

### Node / Bun (self-hosted)

```bash
bun run start
# or
node ./.output/server/index.mjs
```

For the database, use:

```ts
import { sqlite } from '@voila/content-database'
database: sqlite({ url: 'file:./data/voila.db' }),
```

or

```ts
import { postgres } from '@voila/content-database'
database: postgres({ url: env.DATABASE_URL }),
```

For storage, the S3 adapter works with MinIO, Backblaze, Wasabi, Tigris, etc. (see [09](./09-media-storage.md)).

For queues without Cloudflare, set `queue: 'inline'` (runs in-process) or plug in BullMQ via `@voila/queue/bullmq`.

### Vercel / Netlify

Both work via TanStack Start's respective adapters. You give up Cloudflare-specific perks (R2, Queues, D1, Cron Triggers), so:

- Database → Vercel Postgres / Neon / Supabase
- Storage → S3 / Backblaze
- Queues → Upstash QStash adapter (`@voila/queue/qstash`)
- Cron → Vercel Cron or external scheduler

The config swap is mechanical; the rest of the app doesn't change.

---

## Self-hosting checklist

1. Set `VOILA_AUTH_SECRET` to a strong random value (used by Better Auth to sign sessions).
2. Configure `storage.publicUrl` to a CDN-fronted hostname.
3. Enable backups on your D1/Postgres.
4. Set retention windows you can live with (`versionDays`, `trashDays`, `auditDays`).
5. Add at least one admin user (`voila seed admin`).
6. Configure email provider for Better Auth magic links: `auth.email.from`, SMTP or Resend/Postmark.
7. Decide on `mcp.auth`: `bearer` for internal use, `oauth` for end-user agents.
8. Run `voila doctor` — it checks all of the above.

## Cost back-of-envelope (Cloudflare, mid-size blog)

- Workers: free tier covers ~100k req/day; otherwise $5/mo flat.
- D1: free tier covers most blogs.
- R2: $0.015/GB/mo, no egress fees.
- Queues: 1M ops free, then $0.40/M.
- Total: realistic small site = **$0–$5/mo**.

The framework adds nothing to that bill. There is no SaaS layer.

---

Continue → [12 — Roadmap](./12-roadmap.md)
