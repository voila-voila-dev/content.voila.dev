// Messages for the shell area — see ./index.tsx. `fr` is typed against `en`, so
// a key added to one catalog without the other is a compile error.

export const en = {
  // Sidebar + page chrome
  overview: "Overview",
  searchEllipsis: "Search…",
  toggleSidebar: "Toggle Sidebar",
  sidebarSheetTitle: "Sidebar",
  sidebarSheetDescription: "Displays the mobile sidebar.",
  sections: "Sections",
  /** Default sidebar group for collections with no `group`. */
  groupCollections: "Collections",
  /** Default sidebar group for singletons with no `group`. */
  groupSingletons: "Content",
  /** The synthesized field group holding ungrouped fields. */
  generalGroup: "General",

  // User menu
  signedIn: "Signed in",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  toggleTheme: "Toggle theme",
  keyboardShortcuts: "Keyboard shortcuts",
  keyboardShortcutsDescription: "Everything the admin listens for.",
  signOut: "Sign out",
  shortcutPalette: "Open the command palette (search, jump, create)",
  shortcutSidebar: "Show or hide the sidebar",
  shortcutMove: "Move through command palette results",
  shortcutOpen: "Open the highlighted result",
  shortcutClose: "Close the palette or an open dialog",

  // Locales
  editingLanguage: "Editing language",
  localeProgress: (locale: string, filled: number, total: number) =>
    `${locale}, ${filled} of ${total} fields translated`,
  /** Split around the locale code, which renders in monospace between them. */
  fallbackBefore: "Untranslated fields fall back to ",
  fallbackAfter: ".",
  shownInLocale: (shown: string, wanted: string) => `Shown in ${shown} (no ${wanted} value)`,
  defaultLocale: "default",

  // Publish status
  statusAll: "All",
  statusDraft: "Draft",
  statusDrafts: "Drafts",
  statusPublished: "Published",
  statusScheduled: "Scheduled",
  publish: "Publish",
  unpublish: "Unpublish",

  // Confirm dialog
  areYouSure: "Are you sure?",

  // Revisions
  revisionHistory: "Revision history",
  noRevisions: "No revisions yet.",
  revision: (rev: number) => `Revision ${rev}`,
  current: "Current",
  restore: "Restore",
  loadMore: "Load more",

  // Dashboard
  newShort: "New",
  createNew: "Create new",
  noCollections: "No collections configured.",
  recentlyEdited: "Recently edited",
  nothingEdited: "Nothing edited yet.",

  // Preview
  preview: "Preview",
  updating: "Updating…",
  desktopWidth: "Desktop width",
  mobileWidth: "Mobile width",
  reloadPreview: "Reload preview",
  openPreviewInTab: "Open preview in a new tab",
};

export const fr: typeof en = {
  overview: "Accueil",
  searchEllipsis: "Rechercher…",
  toggleSidebar: "Afficher ou masquer le menu",
  sidebarSheetTitle: "Menu",
  sidebarSheetDescription: "Le menu de navigation.",
  sections: "Sections",
  groupCollections: "Contenus",
  groupSingletons: "Réglages",
  generalGroup: "Général",

  signedIn: "Connecté",
  theme: "Thème",
  themeSystem: "Automatique",
  themeLight: "Clair",
  themeDark: "Sombre",
  toggleTheme: "Changer de thème",
  keyboardShortcuts: "Raccourcis clavier",
  keyboardShortcutsDescription: "Tous les raccourcis disponibles.",
  signOut: "Se déconnecter",
  shortcutPalette: "Ouvrir la recherche (chercher, aller à, créer)",
  shortcutSidebar: "Afficher ou masquer le menu",
  shortcutMove: "Parcourir les résultats de la recherche",
  shortcutOpen: "Ouvrir le résultat sélectionné",
  shortcutClose: "Fermer la recherche ou une fenêtre",

  editingLanguage: "Langue modifiée",
  localeProgress: (locale, filled, total) =>
    `${locale}, ${filled} champ${filled > 1 ? "s" : ""} traduit${filled > 1 ? "s" : ""} sur ${total}`,
  fallbackBefore: "Les champs non traduits reprennent la version ",
  fallbackAfter: ".",
  shownInLocale: (shown, wanted) => `Affiché en ${shown} (pas de version ${wanted})`,
  defaultLocale: "par défaut",

  statusAll: "Tous",
  statusDraft: "Brouillon",
  statusDrafts: "Brouillons",
  statusPublished: "Publié",
  statusScheduled: "Programmé",
  publish: "Publier",
  unpublish: "Dépublier",

  areYouSure: "Confirmer ?",

  revisionHistory: "Historique des versions",
  noRevisions: "Aucune version pour l’instant.",
  revision: (rev) => `Version ${rev}`,
  current: "Actuelle",
  restore: "Restaurer",
  loadMore: "Afficher plus",

  newShort: "Ajouter",
  createNew: "Ajouter un élément",
  noCollections: "Aucun contenu configuré.",
  recentlyEdited: "Modifié récemment",
  nothingEdited: "Rien n’a encore été modifié.",

  preview: "Aperçu",
  updating: "Mise à jour…",
  desktopWidth: "Largeur ordinateur",
  mobileWidth: "Largeur téléphone",
  reloadPreview: "Recharger l’aperçu",
  openPreviewInTab: "Ouvrir l’aperçu dans un nouvel onglet",
};
