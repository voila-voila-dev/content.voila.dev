---
"@voila/content-database": minor
---

Add the `d1` adapter at `@voila/content-database/d1`.

Wraps `drizzle-orm/d1` around a Cloudflare D1 binding from the worker `env`.
`dialect` is `"sqlite"` (D1 speaks SQLite SQL) and `close()` is omitted
because D1 is connectionless.

```ts
import { d1 } from "@voila/content-database/d1";

export default {
  fetch(request: Request, env: { DATABASE: D1Database }) {
    const adapter = d1({ binding: env.DATABASE });
    // hand `adapter` to `@voila/content`
  },
};
```
