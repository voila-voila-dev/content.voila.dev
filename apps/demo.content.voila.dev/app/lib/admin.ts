// The admin instance: the typed client + extension config, built once from
// `content.config.ts`. This demo customizes the field widgets — the Plate-based
// rich-text editor for `richText`/`markdown`, and the media uploader for `media`
// (localized `richText` renders one editor per locale automatically, from the
// config's `i18n.locales`). Everything else is the config-driven default.

import { defineAdmin } from "@voila/content-admin";
import { createMediaInput } from "@voila/content-ui";
import config from "../../content.config";
import { RichTextInput } from "../components/widgets/rich-text";
import { RichTextDisplay } from "../components/widgets/rich-text-display";
// The SVG mark shown in the sidebar header (`?url` → a served asset path passed
// to `branding.logo` as an image `src`). The same mark backs the favicon.
import logoUrl from "../logo.svg?url";
import { mediaClient } from "./content-client";
import { fetchCounts } from "./counts";

export const admin = defineAdmin({
  config,
  branding: { title: "Demo", logo: logoUrl, favicon: logoUrl },
  // The admin themes itself from the cinema's own settings: whatever colour an
  // editor picks in Settings → Branding becomes the admin's accent (buttons,
  // active nav item, focus rings, map pins) on the very next load, in both
  // light and dark. `logoFrom` is the fallback for the sidebar mark and the
  // favicon — here `branding.logo` above already wins, so the demo shows the
  // colour half. Both are read server-side by `fetchBrand`.
  theme: { accentFrom: "settings.primaryColor", logoFrom: "settings.logo" },
  // Per-collection counts for the sidebar badges + dashboard tiles (a server fn).
  counts: () => fetchCounts(),
  widgets: {
    edit: {
      richText: RichTextInput,
      markdown: RichTextInput,
      // `list` is what turns on "Choose existing": the same asset can back a
      // dozen documents instead of being uploaded once per document.
      media: createMediaInput({
        upload: (file, opts) => mediaClient.upload(file, opts),
        list: (params) => mediaClient.list(params),
      }),
    },
    display: { richText: RichTextDisplay },
  },
});
