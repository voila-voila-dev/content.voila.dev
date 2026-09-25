---
"@voila/content-admin": patch
"@voila/content-ui": patch
---

The sign-in screen's "the first account to sign in becomes the admin" line is
now its own message (`admin.signInFirstAccount`) and can be turned off with
`defineAdmin({ signIn: { firstAccountIsAdmin: false } })` — for admins behind
an access policy such as `allowlistAccess()`, where it isn't true.
