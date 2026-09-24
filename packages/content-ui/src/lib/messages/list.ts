// Messages for the list area (tables, saved views, filters, columns, board,
// calendar, map) — see ./index.tsx. `fr` is typed against `en`, so a key added
// to one catalog without the other is a compile error.

type FilterOp = "eq" | "ne" | "contains" | "gt" | "gte" | "lt" | "lte";
type ViewType = "table" | "kanban" | "calendar" | "map";

const count = (n: number, locale?: string) => n.toLocaleString(locale);

export const en = {
  // List page
  /** Search box placeholder; `heading` is the lower-cased collection label. */
  searchIn: (heading: string) => `Search ${heading}…`,
  filterByTitle: "Filter by title…",
  noRecords: "No records.",
  results: (n: number) => (n === 1 ? "1 result" : `${n} results`),
  showingOf: (n: number, total: number, locale?: string) =>
    `Showing ${count(n, locale)} of ${count(total, locale)} ${total === 1 ? "record" : "records"}`,
  showing: (n: number, more: boolean, locale?: string) =>
    `Showing ${count(n, locale)} ${n === 1 ? "record" : "records"}${more ? " — more available" : ""}`,
  /** Empty state title; `heading` is the lower-cased collection label. */
  emptyTitle: (heading: string) => `No ${heading} yet`,
  emptySearch: "Nothing matches this search. Try another term or clear the filters.",
  emptyTitleFilter:
    "No loaded record has a matching title. Clear the filter, or load more records.",
  emptyHint: "Records you create will show up here.",
  comfortableRows: "Comfortable rows",
  compactRows: "Compact rows",
  selected: (n: number) => `${n} selected`,
  clearSelection: "Clear",
  perPage: "Per page",
  rowsPerPage: "Rows per page",
  loadMore: "Load more",

  // Table
  selectAll: "Select all rows",
  actions: "Actions",
  /** Fallback row name when a row has no title. */
  rowN: (n: number) => `row ${n}`,
  selectRow: (name: string) => `Select ${name}`,
  openRow: (name: string) => `Open ${name}`,

  // Saved views
  views: "Views",
  viewTypes: {
    table: "Table",
    kanban: "Board",
    calendar: "Calendar",
    map: "Map",
  } as Record<ViewType, string>,
  viewName: "View name",
  viewType: "View type",
  typeLabel: "Type",
  groupBy: "Group by",
  plot: "Plot",
  start: "Start",
  end: "End",
  noEnd: "No end",
  createView: "Create view",
  addView: "Add view",
  addViewHint: "Create a shared view — it's the same for everyone.",
  editView: "Edit view",
  editViewHint: "Rename this shared view.",
  defaultView: "Default view",
  setDefault: "Set as default",
  removeDefault: "Remove default",

  // Filters
  filters: "Filters",
  noFilters: "No filters yet.",
  addFilter: "Add filter",
  removeFilter: "Remove filter",
  filterField: "Filter field",
  filterOperator: "Filter operator",
  filterValue: "Filter value",
  ops: {
    eq: "is",
    ne: "is not",
    contains: "contains",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
  } as Record<FilterOp, string>,
  booleanTrue: "true",
  booleanFalse: "false",

  // Columns
  columns: "Columns",
  moveUp: (label: string) => `Move ${label} up`,
  moveDown: (label: string) => `Move ${label} down`,

  // Map
  map: "Map",
};

const plural = (n: number, one: string, many: string) => (n <= 1 ? one : many);

export const fr: typeof en = {
  searchIn: (heading) => `Rechercher dans ${heading}…`,
  filterByTitle: "Filtrer par titre…",
  noRecords: "Aucun élément.",
  results: (n) => `${n} ${plural(n, "résultat", "résultats")}`,
  showingOf: (n, total, locale) =>
    `${count(n, locale)} ${plural(n, "élément affiché", "éléments affichés")} sur ${count(total, locale)}`,
  showing: (n, more, locale) =>
    `${count(n, locale)} ${plural(n, "élément affiché", "éléments affichés")}${more ? " — il y en a d'autres" : ""}`,
  emptyTitle: (heading) => `Rien dans ${heading} pour l'instant`,
  emptySearch: "Aucun résultat. Essayez un autre mot ou retirez les filtres.",
  emptyTitleFilter:
    "Aucun titre ne correspond parmi les éléments chargés. Retirez le filtre ou chargez-en plus.",
  emptyHint: "Ce que vous ajoutez apparaîtra ici.",
  comfortableRows: "Lignes aérées",
  compactRows: "Lignes serrées",
  selected: (n) => `${n} ${plural(n, "sélectionné", "sélectionnés")}`,
  clearSelection: "Tout désélectionner",
  perPage: "Par page",
  rowsPerPage: "Lignes par page",
  loadMore: "Afficher plus",

  selectAll: "Tout sélectionner",
  actions: "Actions",
  rowN: (n) => `ligne ${n}`,
  selectRow: (name) => `Sélectionner ${name}`,
  openRow: (name) => `Ouvrir ${name}`,

  views: "Vues",
  viewTypes: {
    table: "Tableau",
    kanban: "Colonnes",
    calendar: "Calendrier",
    map: "Carte",
  },
  viewName: "Nom de la vue",
  viewType: "Type de vue",
  typeLabel: "Type",
  groupBy: "Regrouper par",
  plot: "Position",
  start: "Début",
  end: "Fin",
  noEnd: "Pas de fin",
  createView: "Créer la vue",
  addView: "Ajouter une vue",
  addViewHint: "Créez une vue partagée : tout le monde verra la même.",
  editView: "Modifier la vue",
  editViewHint: "Renommez cette vue partagée.",
  defaultView: "Vue par défaut",
  setDefault: "Définir par défaut",
  removeDefault: "Ne plus utiliser par défaut",

  filters: "Filtres",
  noFilters: "Aucun filtre pour l'instant.",
  addFilter: "Ajouter un filtre",
  removeFilter: "Retirer le filtre",
  filterField: "Champ filtré",
  filterOperator: "Condition",
  filterValue: "Valeur du filtre",
  ops: {
    eq: "est",
    ne: "n'est pas",
    contains: "contient",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
  },
  booleanTrue: "oui",
  booleanFalse: "non",

  columns: "Colonnes",
  moveUp: (label) => `Monter ${label}`,
  moveDown: (label) => `Descendre ${label}`,

  map: "Carte",
};
