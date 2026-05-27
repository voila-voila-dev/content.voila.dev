# @voila/content-auth

> Provides the `Auth` Service: session resolution, identity, and RBAC subject; Better Auth is bridged as the default `Layer`. **World:** Engine. **Layer:** —. **Status:** M3 target.

## Responsibility

Owns: the `Auth` `Service` interface (session resolution, `getSession`, `requireSession`, identity shape); the Better Auth bridge `Layer` (magic-link, cookie management, mailer resolution); the `AuthSubject` type used by RBAC in `@voila/content`.

Does not own: RBAC predicate evaluation (that is `@voila/content`), CSRF token management (that is `@voila/content/server`'s middleware), or the mailer transport implementations (Resend, SMTP, console — these are sub-Layers within this package).

## Public API

```ts
// The Auth Service tag — depend on this, not on Better Auth directly
export declare class Auth extends Context.Tag("@voila/content-auth/Auth")<
  Auth,
  {
    getSession(request: Request): Effect.Effect<AuthSession | null>
    requireSession(request: Request): Effect.Effect<AuthSession, UnauthorizedError>
    handler(request: Request): Effect.Effect<Response>  // the /admin/api/auth/* catch-all
  }
>() {}

export interface AuthSession {
  userId: string
  email: string
  expiresAt: Date
}

// Default Layer — Better Auth with magic-link + resolved mailer
export declare const BetterAuthLive: (config: AuthConfig) => Layer.Layer<Auth, never, Database>

// Mailer sub-Layers (compose into BetterAuthLive or provide directly)
export declare const ResendMailerLive: (opts: { apiKey: string }) => Layer.Layer<Mailer>
export declare const SmtpMailerLive: (opts: SmtpOpts) => Layer.Layer<Mailer>
export declare const ConsoleMailerLive: Layer.Layer<Mailer>   // dev/test default

export interface AuthConfig {
  email?: { from?: string }
  sessionTtl?: string          // e.g. "7d"
  baseUrl?: string
  authentication?: Record<string, unknown>  // passthrough to Better Auth options
}
```

## Effect surface

- `Effect`, `Layer`, `Context` — the core seam; all auth operations are `Effect`-typed internally.
- Better Auth is a concrete implementation detail inside `BetterAuthLive`; it never leaks through the `Auth` interface.
- `@effect/sql` — the `Database` `Service` (from `@voila/content-sql`) is the `Layer` requirement for `BetterAuthLive`; auth tables are created via the same `Migrator`.

## Dependencies

```
@voila/content-sql              # Database Service (required by BetterAuthLive)
better-auth             # implementation detail of BetterAuthLive (peer)
effect
```

## Usage

Happy path — compose via `defineContent` (the umbrella wires `BetterAuthLive` automatically):

```ts
// content.config.ts
import { defineContent } from "@voila/content"
export default defineContent({
  auth: { sessionTtl: "7d", email: { from: "admin@acme.com" } },
  // ...
})
```

Power user — swap the mailer `Layer`:

```ts
import { BetterAuthLive, ResendMailerLive } from "@voila/content-auth"
import { Layer } from "effect"

const AuthWithResend = BetterAuthLive(config).pipe(
  Layer.provide(ResendMailerLive({ apiKey: env.RESEND_KEY })),
)
```

Power user — replace the entire auth `Layer` (e.g. Clerk or custom JWT):

```ts
import { Auth } from "@voila/content-auth"
import { Layer, Effect } from "effect"

const ClerkAuth = Layer.succeed(Auth, {
  getSession: (req) => Effect.tryPromise(() => clerkClient.verifyRequest(req)),
  requireSession: (req) => /* ... */,
  handler: (req) => /* ... */,
})
// Provide ClerkAuth anywhere Auth is required
```

## Extension points (A′)

- Replace `BetterAuthLive` with any `Layer.Layer<Auth>` — the engine only depends on the `Auth` tag, never on Better Auth.
- Compose additional Better Auth plugins by passing them through `authentication` in `AuthConfig`.
- Swap the `Mailer` sub-Layer independently without replacing the whole auth layer.

## Replaces

Supersedes `@voila/content-auth` (`packages/auth/`) — `createAuth`, `CreateAuthOptions`, `mergeBetterAuthOptions`, `parseDurationSeconds`, the Drizzle adapter wiring, and the middleware in `packages/auth/src/middleware/`. The `getSessionSafe` fail-soft resolver becomes `Auth.getSession` (which is effect-typed and fails soft by contract). Mailer implementations (`resend.ts`, `smtp.ts`, `console.ts`) are preserved as sub-Layers.
