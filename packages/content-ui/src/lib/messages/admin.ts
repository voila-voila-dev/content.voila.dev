// Messages for the admin area (the `@voila/content-admin` screens) — see
// ./index.tsx. `fr` is typed against `en`, so a key added to one catalog
// without the other is a compile error.

const records = (n: number) => (n === 1 ? "record" : "records");
const fiches = (n: number) => (n > 1 ? "fiches" : "fiche");

export const en = {
  // Login
  signInTitle: "Sign in",
  signInDescription:
    "We'll email you a magic link. The first account to sign in becomes the admin.",
  checkInbox: "Check your inbox",
  sentLinkBefore: "We sent a sign-in link to",
  sentLinkAfter: ". It expires shortly, so open it soon.",
  useDifferentEmail: "Use a different email",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  sending: "Sending…",
  sendMagicLink: "Send magic link",
  signInInvalidEmail: "That doesn't look like a valid email address. Check it and try again.",
  signInNotAllowed:
    "This address isn't allowed to sign in. Ask an admin to invite it, or use the address you were invited with.",
  signInNoAccount: "We couldn't find an account for that address.",
  signInRejected: "That email address was rejected. Check it for typos and try again.",
  signInTooMany: "Too many attempts. Wait a minute, then request another link.",
  signInServerError: "Sending the link failed on our side. Try again in a moment.",
  signInFailed: "We couldn't send the sign-in link. Try again in a moment.",
  signInNetwork: "We couldn't reach the server. Check your connection and try again.",

  // Toasts
  created: "Created",
  deleted: "Deleted",
  published: "Published",
  unpublished: "Unpublished",
  couldNotCreate: "Could not create the record.",
  couldNotSave: "Could not save the changes.",
  couldNotDelete: "Could not delete the record.",
  couldNotUndoDelete: "Could not undo the delete.",
  couldNotApply: "Could not apply the change.",
  couldNotPublish: "Could not publish.",
  couldNotUnpublish: "Could not unpublish.",
  couldNotRestoreRevision: "Could not restore the revision.",
  undo: "Undo",
  deletedSomeFailed: (deleted: number, failed: number) => `Deleted ${deleted}, ${failed} failed.`,
  deletedCount: (n: number) => `Deleted ${n} ${records(n)}`,
  restoredSomeFailed: (restored: number, failed: number) =>
    `Restored ${restored}, ${failed} failed.`,
  restoredCount: (n: number) => `Restored ${n} ${records(n)}`,
  updatedSomeFailed: (label: string, updated: number, failed: number) =>
    `${label}: ${updated} updated, ${failed} failed.`,
  updatedCount: (label: string, n: number) => `${label} · ${n} ${records(n)}`,
  restoredRevision: (rev: number) => `Restored revision ${rev}`,

  // Unsaved-changes guard
  leaveTitle: "Leave without saving?",
  /** `label` is the singular collection label, lower-cased; absent → generic. */
  leaveDescription: (label?: string) =>
    `Your changes to ${label === undefined ? "this record" : `this ${label}`} have not been saved. Leaving now discards them.`,
  keepEditing: "Keep editing",
  saveAndLeave: "Save and leave",
  discardChanges: "Discard changes",

  // Back links / navigation
  backTo: (label: string) => `Back to ${label}`,
  backToOverview: "Back to overview",
  overview: "Overview",
  settings: "Settings",
  history: "History",

  // Collection list
  filter: "Filter",
  filters: (n: number) => `Filters (${n})`,
  columns: "Columns",
  cardFields: "Card fields",
  mapPosition: "Map position",
  latitude: "Latitude",
  longitude: "Longitude",
  zoom: "Zoom",
  resetAutoFit: "Reset to auto-fit",
  showingFirst: (n: number) =>
    `Showing the first ${n} records. Narrow the set with a filter to see more.`,
  copySuffix: " (copy)",
  rowActions: (singular: string) => `Actions for this ${singular}`,
  duplicate: "Duplicate",
  setField: (field: string) => `Set ${field}`,
  setFieldTo: (field: string, value: string) => `Set ${field} to ${value}`,
  exportCsv: "Export CSV",
  deleteCount: (n: number) => `Delete ${n}`,
  deleteCountTitle: (n: number) => `Delete ${n} ${records(n)}?`,
  bulkDeleteDescription:
    "It's a soft delete. You'll get an Undo in the confirmation toast, and the records stay recoverable through the API after that.",

  // Collection detail / new / singleton
  editTitle: (title: string) => `Edit ${title}`,
  done: "Done",
  notFoundShort: "Not found.",
  moreActions: "More actions",
  deleteThis: (singular: string) => `Delete this ${singular}?`,
  deleteDescription: "It's a soft delete — the record is hidden but recoverable through the API.",
  newTitle: (singular: string) => `New ${singular}`,
  nothingYet: (label: string) => `No ${label} yet.`,

  // Record pager / status / preview
  previousRecord: "Previous record (K)",
  nextRecord: "Next record (J)",
  statusIs: (label: string) => `Status: ${label}. Change it.`,
  setStatus: "Set status",
  showPreview: "Show preview",
  hidePreview: "Hide preview",

  // 404
  notFound: "Not found",
  nothingHere: "There's nothing at this address",
  noScreenFor: "No collection or screen is registered for",
  noScreenForThis: "No collection or screen is registered for this path.",

  // Command palette
  paletteTitle: "Search and jump",
  paletteDescription: "Jump to a collection, create a record, or search documents.",
  palettePlaceholder: "Search or jump to…",
  paletteNoResults: "No results.",
  goTo: "Go to",
  actions: "Actions",
  toggleTheme: "Toggle theme",
  createGroup: "Create",
};

export const fr: typeof en = {
  signInTitle: "Connexion",
  signInDescription:
    "Nous vous envoyons un lien de connexion par e-mail. Le premier compte connecté devient administrateur.",
  checkInbox: "Consultez votre boîte mail",
  sentLinkBefore: "Nous avons envoyé un lien de connexion à",
  sentLinkAfter: ". Il expire vite : ouvrez-le rapidement.",
  useDifferentEmail: "Utiliser une autre adresse",
  emailLabel: "Adresse e-mail",
  emailPlaceholder: "vous@exemple.fr",
  sending: "Envoi…",
  sendMagicLink: "Recevoir le lien de connexion",
  signInInvalidEmail: "Cette adresse e-mail ne semble pas valide. Vérifiez-la et réessayez.",
  signInNotAllowed:
    "Cette adresse n'a pas accès à l'administration. Demandez à un administrateur de l'inviter, ou utilisez l'adresse avec laquelle vous avez été invité.",
  signInNoAccount: "Aucun compte ne correspond à cette adresse.",
  signInRejected:
    "Cette adresse e-mail a été refusée. Vérifiez qu'il n'y a pas de faute de frappe.",
  signInTooMany: "Trop de tentatives. Patientez une minute, puis demandez un nouveau lien.",
  signInServerError: "L'envoi du lien a échoué de notre côté. Réessayez dans un instant.",
  signInFailed: "Impossible d'envoyer le lien de connexion. Réessayez dans un instant.",
  signInNetwork: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",

  created: "Créé",
  deleted: "Supprimé",
  published: "Publié",
  unpublished: "Dépublié",
  couldNotCreate: "Impossible de créer la fiche.",
  couldNotSave: "Impossible d'enregistrer les modifications.",
  couldNotDelete: "Impossible de supprimer la fiche.",
  couldNotUndoDelete: "Impossible d'annuler la suppression.",
  couldNotApply: "Impossible d'appliquer la modification.",
  couldNotPublish: "Impossible de publier.",
  couldNotUnpublish: "Impossible de dépublier.",
  couldNotRestoreRevision: "Impossible de restaurer cette version.",
  undo: "Annuler",
  deletedSomeFailed: (deleted, failed) => `${deleted} supprimée(s), ${failed} en échec.`,
  deletedCount: (n) => `${n} ${fiches(n)} ${n > 1 ? "supprimées" : "supprimée"}`,
  restoredSomeFailed: (restored, failed) => `${restored} restaurée(s), ${failed} en échec.`,
  restoredCount: (n) => `${n} ${fiches(n)} ${n > 1 ? "restaurées" : "restaurée"}`,
  updatedSomeFailed: (label, updated, failed) =>
    `${label} : ${updated} modifiée(s), ${failed} en échec.`,
  updatedCount: (label, n) => `${label} · ${n} ${fiches(n)}`,
  restoredRevision: (rev) => `Version ${rev} restaurée`,

  leaveTitle: "Quitter sans enregistrer ?",
  leaveDescription: () =>
    "Vos modifications n'ont pas été enregistrées. Si vous quittez maintenant, elles seront perdues.",
  keepEditing: "Continuer la saisie",
  saveAndLeave: "Enregistrer et quitter",
  discardChanges: "Abandonner les modifications",

  backTo: (label) => `Retour : ${label}`,
  backToOverview: "Retour à l'accueil",
  overview: "Accueil",
  settings: "Réglages",
  history: "Historique",

  filter: "Filtrer",
  filters: (n) => `Filtres (${n})`,
  columns: "Colonnes",
  cardFields: "Champs des cartes",
  mapPosition: "Position de la carte",
  latitude: "Latitude",
  longitude: "Longitude",
  zoom: "Zoom",
  resetAutoFit: "Recadrer automatiquement",
  showingFirst: (n) =>
    `Affichage des ${n} premières fiches. Ajoutez un filtre pour affiner et voir les autres.`,
  copySuffix: " (copie)",
  rowActions: () => "Actions sur cette fiche",
  duplicate: "Dupliquer",
  setField: (field) => `Changer : ${field}`,
  setFieldTo: (field, value) => `${field} → ${value}`,
  exportCsv: "Exporter en CSV",
  deleteCount: (n) => `Supprimer (${n})`,
  deleteCountTitle: (n) => `Supprimer ${n} ${fiches(n)} ?`,
  bulkDeleteDescription:
    "Vous pourrez annuler juste après depuis la notification de confirmation. Les fiches restent récupérables ensuite.",

  editTitle: (title) => `Modifier : ${title}`,
  done: "Terminé",
  notFoundShort: "Introuvable.",
  moreActions: "Plus d'actions",
  deleteThis: () => "Supprimer cette fiche ?",
  deleteDescription: "La fiche est masquée, mais elle reste récupérable.",
  newTitle: (singular) => `Ajouter : ${singular}`,
  nothingYet: (label) => `${label} : rien pour l'instant.`,

  previousRecord: "Fiche précédente (K)",
  nextRecord: "Fiche suivante (J)",
  statusIs: (label) => `Statut : ${label}. Le modifier.`,
  setStatus: "Choisir un statut",
  showPreview: "Afficher l'aperçu",
  hidePreview: "Masquer l'aperçu",

  notFound: "Page introuvable",
  nothingHere: "Il n'y a rien à cette adresse",
  noScreenFor: "Aucune rubrique ne correspond à",
  noScreenForThis: "Aucune rubrique ne correspond à cette adresse.",

  paletteTitle: "Rechercher et aller à",
  paletteDescription: "Ouvrir une rubrique, ajouter une fiche ou chercher un contenu.",
  palettePlaceholder: "Rechercher ou aller à…",
  paletteNoResults: "Aucun résultat.",
  goTo: "Aller à",
  actions: "Actions",
  toggleTheme: "Changer de thème (clair / sombre)",
  createGroup: "Ajouter",
};
