// Localization for the public site.
//
// The locale is a `?lang=pt-PT` search parameter (declared once on the root
// route, so every route inherits it) — one URL per page, a language switcher in
// the header, and the default locale left out of the URL entirely. Content
// fields are resolved through the engine's locale chain, so a field that has no
// Portuguese translation yet falls back to en-US rather than rendering blank;
// this file only carries the site's own chrome strings.

export const LOCALES = ["en-US", "pt-PT"] as const;
export type Lang = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Lang = "en-US";

/** The cinema is in Lisbon, so every date on the site is Lisbon's. Pinning the
 *  zone also keeps server-rendered and client-navigated output identical. */
export const TIME_ZONE = "Europe/Lisbon";

export function isLang(value: unknown): value is Lang {
  return value === "en-US" || value === "pt-PT";
}

/** The search object to attach to a `<Link>` so navigation keeps the language. */
export function langSearch(lang: Lang): { lang?: Lang } {
  return lang === DEFAULT_LOCALE ? {} : { lang };
}

interface Strings {
  readonly programme: string;
  readonly films: string;
  readonly journal: string;
  readonly visit: string;
  readonly thisWeek: string;
  readonly thisWeekBlurb: string;
  readonly featured: string;
  readonly fromTheJournal: string;
  readonly latestEntry: string;
  readonly allScreenings: string;
  readonly allFilms: string;
  readonly readMore: string;
  readonly nothingScheduled: string;
  readonly noFilms: string;
  readonly noEntries: string;
  readonly upcomingScreenings: string;
  readonly noUpcoming: string;
  readonly directedBy: string;
  readonly programmeNote: string;
  readonly formats: string;
  readonly trailer: string;
  readonly watchTrailer: string;
  readonly writtenAbout: string;
  readonly allScreens: string;
  readonly screen: string;
  readonly soldOut: string;
  readonly tickets: string;
  readonly bookTickets: string;
  readonly minutes: string;
  readonly certificate: string;
  readonly shotIn: string;
  readonly filmsDirected: string;
  readonly entriesWritten: string;
  readonly biography: string;
  readonly address: string;
  readonly openingHours: string;
  readonly contact: string;
  readonly findUs: string;
  readonly coordinates: string;
  readonly notFoundTitle: string;
  readonly notFoundBody: string;
  readonly backHome: string;
  readonly by: string;
  readonly language: string;
  readonly skipToContent: string;
  readonly poweredBy: string;
  readonly today: string;
  readonly tomorrow: string;
  readonly screenings: string;
}

const EN: Strings = {
  programme: "Programme",
  films: "Films",
  journal: "Journal",
  visit: "Visit",
  thisWeek: "This week",
  thisWeekBlurb: "The next seven days on both screens and the esplanade.",
  featured: "Featured",
  fromTheJournal: "From the journal",
  latestEntry: "Latest entry",
  allScreenings: "Full programme",
  allFilms: "All films",
  readMore: "Read the entry",
  nothingScheduled: "Nothing is scheduled yet. The next programme is being assembled.",
  noFilms: "The catalogue is being assembled.",
  noEntries: "Nothing has been published yet.",
  upcomingScreenings: "Upcoming screenings",
  noUpcoming: "No dates announced yet.",
  directedBy: "Directed by",
  programmeNote: "Programme note",
  formats: "Formats",
  trailer: "Trailer",
  watchTrailer: "Watch the trailer",
  writtenAbout: "Written about this film",
  allScreens: "All screens",
  screen: "Screen",
  soldOut: "Sold out",
  tickets: "Tickets",
  bookTickets: "Book",
  minutes: "min",
  certificate: "Cert.",
  shotIn: "Shot in",
  filmsDirected: "Films in the catalogue",
  entriesWritten: "Journal entries",
  biography: "Biography",
  address: "Address",
  openingHours: "Opening hours",
  contact: "Contact",
  findUs: "Find us",
  coordinates: "Coordinates",
  notFoundTitle: "Wrong screen",
  notFoundBody: "That page isn’t in tonight’s programme. It may have been taken down.",
  backHome: "Back to the marquee",
  by: "by",
  language: "Language",
  skipToContent: "Skip to content",
  poweredBy: "Published with Voilà",
  today: "Today",
  tomorrow: "Tomorrow",
  screenings: "screenings",
};

const PT: Strings = {
  programme: "Programa",
  films: "Filmes",
  journal: "Diário",
  visit: "Visitar",
  thisWeek: "Esta semana",
  thisWeekBlurb: "Os próximos sete dias nas duas salas e na esplanada.",
  featured: "Em destaque",
  fromTheJournal: "Do diário",
  latestEntry: "Última entrada",
  allScreenings: "Programa completo",
  allFilms: "Todos os filmes",
  readMore: "Ler a entrada",
  nothingScheduled: "Ainda não há sessões marcadas. O próximo programa está a ser montado.",
  noFilms: "O catálogo está a ser montado.",
  noEntries: "Ainda não foi publicado nada.",
  upcomingScreenings: "Próximas sessões",
  noUpcoming: "Ainda sem datas anunciadas.",
  directedBy: "Realização de",
  programmeNote: "Nota de programa",
  formats: "Formatos",
  trailer: "Trailer",
  watchTrailer: "Ver o trailer",
  writtenAbout: "Escrito sobre este filme",
  allScreens: "Todas as salas",
  screen: "Sala",
  soldOut: "Esgotado",
  tickets: "Bilhetes",
  bookTickets: "Reservar",
  minutes: "min",
  certificate: "Class.",
  shotIn: "Rodado em",
  filmsDirected: "Filmes no catálogo",
  entriesWritten: "Entradas no diário",
  biography: "Biografia",
  address: "Morada",
  openingHours: "Horário",
  contact: "Contacto",
  findUs: "Onde estamos",
  coordinates: "Coordenadas",
  notFoundTitle: "Sala errada",
  notFoundBody: "Essa página não está no programa desta noite. Pode ter sido retirada.",
  backHome: "Voltar à entrada",
  by: "por",
  language: "Idioma",
  skipToContent: "Saltar para o conteúdo",
  poweredBy: "Publicado com Voilà",
  today: "Hoje",
  tomorrow: "Amanhã",
  screenings: "sessões",
};

export function strings(lang: Lang): Strings {
  return lang === "pt-PT" ? PT : EN;
}
