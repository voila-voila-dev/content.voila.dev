// The admin instance: the typed client + extension config, built once from the
// same `content.config.ts` the public site renders from. One app, one schema,
// two front ends.
//
// It mounts under `/admin` (the public site keeps `/`), which makes the REST +
// auth routes `/admin/api/*` — `apiPath` is left at its default so the mount in
// `routes/admin_.api.$.ts` and `lib/server.ts`'s `basePath` stay in step.

import { defineAdmin } from "@voila/content-admin";
import { createMediaInput } from "@voila/content-ui";
import config from "../../content.config";
import { RichTextInput } from "../components/widgets/rich-text";
import { RichTextDisplay } from "../components/widgets/rich-text-display";
import { mediaClient } from "./content-client";
import { fetchCounts } from "./counts";

export const admin = defineAdmin({
  config,
  basePath: "/admin",
  branding: { title: "Cinéma Vertigo" },
  // The admin themes itself from the cinema's own settings: the colour an editor
  // picks in Settings → Branding is the admin's accent AND the public site's
  // `--accent`, read from the same row. Resolved server-side by `fetchBrand`.
  theme: { accentFrom: "settings.primaryColor", logoFrom: "settings.logo" },
  // Per-collection counts for the sidebar badges + dashboard tiles (a server fn).
  counts: () => fetchCounts(),
  // The way back to the thing being edited. The public site deliberately carries
  // no link the other way: visitors have no business seeing a sign-in door.
  nav: {
    extra: [
      {
        slug: "public-site",
        label: "View site",
        href: "/",
        kind: "collection",
        // Recomputed by the sidebar against the current path; the nav model
        // requires a seed value.
        isActive: false,
        icon: "ArrowSquareOut",
        group: "Site",
      },
    ],
  },
  widgets: {
    edit: {
      richText: RichTextInput,
      markdown: RichTextInput,
      // `list` is what turns on "Choose existing": the same poster can back a
      // dozen documents instead of being uploaded once per document.
      media: createMediaInput({
        upload: (file, opts) => mediaClient.upload(file, opts),
        list: (params) => mediaClient.list(params),
      }),
    },
    display: { richText: RichTextDisplay },
  },
});
