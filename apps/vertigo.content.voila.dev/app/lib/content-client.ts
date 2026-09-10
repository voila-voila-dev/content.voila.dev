// The media client the rich-text editor's image button + the `media` field
// widget upload through (the `_media` pipeline). It shares the framework's
// CSRF-aware fetch (`makeAuthedFetch`). The collection CRUD client lives on the
// admin instance (`./admin`); this is the standalone media client the widgets
// need at module scope.
//
// Both paths are the admin's, so they carry the `/admin` prefix: uploads go to
// `/admin/api/_media` and a 401 bounces to `/admin/login`.

import { makeMediaClient } from "@voila/content/client";
import { makeAuthedFetch } from "@voila/content-admin";

const fetch = makeAuthedFetch({ loginPath: "/admin/login" });

export const mediaClient = makeMediaClient({ baseUrl: "/admin/api", fetch });
