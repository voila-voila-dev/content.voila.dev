// The admin instance: the typed client + extension config, built once from your
// `content.config.ts`. Client-safe (no server/database import) — `AdminProvider`
// shares it with every screen. Customize the admin from here, no eject needed:
//
//   export const admin = defineAdmin({
//     config,
//     branding: { title: "Acme CMS" },
//     screens: [{ id: "analytics", path: "/analytics", nav: { label: "Analytics" }, component: Analytics }],
//     widgets: { edit: { richText: MyEditor } },
//   });

import { defineAdmin } from "@voila/content-admin";
import config from "../../content.config";

export const admin = defineAdmin({ config });
