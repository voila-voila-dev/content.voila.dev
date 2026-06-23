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
import { mediaClient } from "./content-client";

export const admin = defineAdmin({
  config,
  branding: { title: "Demo" },
  widgets: {
    edit: {
      richText: RichTextInput,
      markdown: RichTextInput,
      media: createMediaInput({ upload: (file, opts) => mediaClient.upload(file, opts) }),
    },
    display: { richText: RichTextDisplay },
  },
});
