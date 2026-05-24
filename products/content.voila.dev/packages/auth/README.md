# @voila/content-auth

[Better Auth](https://www.better-auth.com/) wired into the Voila admin handler,
with an email magic-link flow as the default sign-in method.

## Surface

| Subpath                                  | Purpose                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `@voila/content-auth`                    | Re-exports the `createAuth` factory + auth config types. |
| `@voila/content-auth/server`             | Server-only factory + Drizzle schema bridge.             |
| `@voila/content-auth/middleware`         | `requireSession` middleware for `/admin/*` routes.       |
| `@voila/content-auth/mailers`            | `resendMailer`, `smtpMailer`, `consoleMailer`, `resolveMailer`. |
| `@voila/content-auth/schema`             | Drizzle table definitions for the four better-auth tables. |
| `@voila/content-auth/migrations`         | Bundled SQL migrations (`sqlite`, `postgres`).           |

## Auth schema

The package ships the canonical better-auth tables (`user`, `session`,
`account`, `verification`) as a single migration that lives alongside the
collection migrations. `voila migrate apply` runs it next to the user's
schema migration; no extra step.

## Magic link delivery

The `magicLink` plugin is wired in unconditionally. The mailer is resolved at
runtime from environment variables:

1. **Resend** (default) — when `RESEND_API_KEY` is set.
2. **SMTP** — when `SMTP_HOST` is set (uses `nodemailer`).
3. **Console** — fallback for local dev; the magic link is logged to stdout.

`from` is sourced from `auth.email.from` in `content.config.ts`, or
`AUTH_EMAIL_FROM` as a fallback.

## Seeding the first admin

```bash
voila seed admin --email you@example.com --target sqlite --db ./voila.db
voila seed admin --email you@example.com --target d1-local --binding DATABASE
voila seed admin --email you@example.com --target d1-remote --binding DATABASE
```

The command inserts a row into the `user` table with `emailVerified = 1`,
so the next magic-link request signs the address in directly.
