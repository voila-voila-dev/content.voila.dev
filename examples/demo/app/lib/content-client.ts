// The media client the rich-text editor's image button + the `media` field
// widget upload through (the `_media` pipeline). It shares the framework's
// CSRF-aware fetch (`makeAuthedFetch`). The collection CRUD client lives on the
// admin instance (`app/lib/admin.ts`); this is the standalone media client the
// widgets need at module scope.

import { makeMediaClient } from "@voila/content/client";
import { makeAuthedFetch } from "@voila/content-admin";

const fetch = makeAuthedFetch({ loginPath: "/login" });

export const mediaClient = makeMediaClient({ baseUrl: "/api", fetch });
