---
"@voila/content": minor
"@voila/content-ui": minor
"@voila/content-admin": minor
---

Admin in French, phone layout fixes, and a per-field widget option.

- **Chrome messages.** Every visible string of the admin ("Save", "Showing 3 of
  12", "Sign out", validation, toasts, the login screen) now comes from a
  message catalog. `defineAdmin({ locale: "fr-FR" })` switches the whole admin
  to French, not just the dates and numbers; `defineAdmin({ messages })`
  rewords any key (`{ common: { save: "Publier" } }`). `MessagesProvider`,
  `useMessages`, `resolveMessages` and the `en`/`fr` catalogs are exported
  from `@voila/content-ui`; components outside a provider stay in English.
- **Magic-link email.** `resendMailer({ locale })` writes the subject and body
  in French; `createWorkerAdmin` takes `locale` (pass the same value as
  `defineAdmin`) and now names the site in the subject (`brand`, defaulting
  to the config's `branding.name`, where it said "Voila" before).
- **Phone.** The read view stacks each label above its value below 640px,
  and the previous/next record arrows are hidden there so the header keeps
  room for the title and actions.
- **`widget` on every field.** `fields.string({ widget: "cdnImage" })` picks
  the admin widget for that one field, looked up in the registries before
  the field's kind — inside arrays, objects and blocks too. Register it with
  `defineAdmin({ widgets: { edit: { cdnImage }, display: { cdnImage } } })`.
