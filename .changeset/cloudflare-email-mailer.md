---
"@voila/content": minor
"@voila/content-admin": minor
---

Send magic links with Cloudflare Email Service as an alternative to Resend.
`@voila/content/better-auth` exports `cloudflareMailer({ binding, from })` over the
Workers `send_email` binding. `createWorkerAdmin` picks it up from an `EMAIL`
binding (with `VOILA_AUTH_FROM`) when no `RESEND_API_KEY` is set, and takes a new
`mailer` option — `"cloudflare"`, `"resend"`, `"console"` or a custom `Mailer` — to
choose explicitly.
