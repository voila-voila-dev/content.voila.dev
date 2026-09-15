---
"@voila/content-ui": minor
"@voila/content-admin": minor
---

`defineAdmin({ nav: { groups } })` lays the sidebar out explicitly — `{ label, items: [slug, …] }` per group, in order (the dashboard tiles follow); entities the layout doesn't list keep their own `group` and declaration order. Also `buildNav({ groups })`, `AppSidebar` / `AdminShell` / `Dashboard` `navGroups`. A host `branding.logo` now fills the sidebar and login marks instead of sitting on the initial's tint.
