---
"@voila/content": minor
"@voila/content-admin": minor
---

Collection-backed admin allowlist. `allowlistAccess({ collection, field })` (in
`@voila/content/server`) admits the emails listed in one of your own collections
— by default `admins.email`, declared with `defineAdminsCollection()` — instead
of the first-user-wins default. The admin runtime now resolves access *policies*:
`createWorkerAdmin(config, { access: allowlistAccess() })` gates magic-link
sign-in (unknown addresses get a 403 before any email is sent) and exposes
`runtime.policy.admits` for the host's route guard via `resolveAdmission`.
