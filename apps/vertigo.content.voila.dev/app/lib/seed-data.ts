// The cinema's opening programme — what a fresh database is filled with, and
// what both halves of the app show until an editor changes it: a repertory
// season across statuses (the admin's Kanban), shooting locations on the map
// (geo), five weeks of showtimes (Calendar), the people who made and programme
// the films, and a written journal.
//
// The films are REAL. Titles, years, runtimes, countries, directors, synopses
// and artwork come from Cinemeta (https://v3-cinemeta.strem.io), a public,
// keyless metadata service, resolved by SEARCH rather than by remembered IMDb
// ids. Poster and backdrop images are referenced by URL: a `media` value is
// `{ id, url, mime, size }`, so nothing has to be uploaded for artwork to
// render. Programme notes, birthplaces, shooting locations, showtimes and the
// journal are the cinema's own and were written here.
//
// Writes go straight through the runtime `Database` (no REST/validation layer),
// so values are plain JS — `encodeRow` serializes geo/datetime/localized/richText
// columns. Localized fields only need the DEFAULT locale (en-US); a `pt-PT`
// translation can land later, and several fields here deliberately lack one.
// Relations store the target row's id, so seeding runs in dependency order:
// people → films → screenings → journal.

import type { rt } from "@voila/content";
import type { Database } from "@voila/content/server";

/** A minimal rich-text document: one paragraph per string. */
function doc(...paragraphs: string[]): rt.RichTextValue {
  return paragraphs.map((text) => ({
    id: crypto.randomUUID(),
    type: "paragraph",
    children: [{ text }],
  }));
}

/** Epoch ms, `days` from now (negative = past), at a given wall-clock time. */
function daysFromNow(days: number, hour = 9, minute = 0): number {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** "Vertigo · Fri 19 Sep, 21:00" — the handle a programmer scans the list by. */
function labelFor(title: string, startsAt: number): string {
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startsAt);
  return `${title} · ${when}, ${time}`;
}

/** The house adds 20 minutes of trailers and idents to every runtime. */
function endOf(startsAt: number, runtime: number): number {
  return startsAt + (runtime + 20) * 60_000;
}

/** An external image as a `media` value — no upload, just a referenced URL. */
function image(id: string, url: string, size: number, alt: string) {
  return { id, url, mime: "image/jpeg", size, alt };
}

export async function seedProgramme(database: Database): Promise<void> {
  // --- Settings singleton ---
  await database.upsert("settings", {
    siteName: { "en-US": "Cinéma Vertigo", "pt-PT": "Cinéma Vertigo" },
    tagline: {
      "en-US": "Two screens, one esplanade, and a hundred years of film.",
      "pt-PT": "Duas salas, uma esplanada e cem anos de cinema.",
    },
    about: doc(
      "Cinéma Vertigo is an independent repertory cinema in Alfama, Lisbon. We show restored classics and new arthouse on 35mm, 16mm and DCP, seven days a week.",
      "Every season is programmed in-house. Most screenings are introduced, and once a month a guest joins us for a Q&A on the esplanade.",
    ),
    primaryColor: "#8e1b1b",
    address: "Rua dos Remédios 148, 1100-445 Lisboa",
    location: { lat: 38.7139, lng: -9.1259 },
    openingHours: {
      "en-US": "Box office opens at 17:00. First screening at 18:30.",
      "pt-PT": "Bilheteira abre às 17:00. Primeira sessão às 18:30.",
    },
    contactEmail: "bilheteira@cinemavertigo.pt",
    instagram: "https://instagram.com/cinemavertigo",
  });

  // --- People: the directors on the programme, plus the house team ---
  const person: Record<string, string> = {};
  async function addPerson(input: Record<string, unknown>): Promise<void> {
    const row = (await database.create("people", input)) as { id: string };
    person[input.slug as string] = row.id;
  }

  await addPerson({
    name: "Alfred Hitchcock",
    slug: "alfred-hitchcock",
    role: "Director",
    bio: { "en-US": doc("Films by Alfred Hitchcock on this season's programme.") },
    bornIn: { lat: 51.5074, lng: -0.1278 },
  }); // London
  await addPerson({
    name: "Paulo Rocha",
    slug: "paulo-rocha",
    role: "Director",
    bio: { "en-US": doc("Films by Paulo Rocha on this season's programme.") },
    bornIn: { lat: 41.1579, lng: -8.6291 },
  }); // Porto
  await addPerson({
    name: "Miguel Gomes",
    slug: "miguel-gomes",
    role: "Director",
    bio: { "en-US": doc("Films by Miguel Gomes on this season's programme.") },
    bornIn: { lat: 38.7223, lng: -9.1393 },
  }); // Lisbon
  await addPerson({
    name: "Djibril Diop Mambéty",
    slug: "djibril-diop-mambety",
    role: "Director",
    bio: { "en-US": doc("Films by Djibril Diop Mambéty on this season's programme.") },
    bornIn: { lat: 14.7167, lng: -17.4677 },
  }); // Dakar
  await addPerson({
    name: "Yasujirô Ozu",
    slug: "yasujiro-ozu",
    role: "Director",
    bio: { "en-US": doc("Films by Yasujirô Ozu on this season's programme.") },
    bornIn: { lat: 35.6762, lng: 139.6503 },
  }); // Tokyo
  await addPerson({
    name: "Agnès Varda",
    slug: "agnes-varda",
    role: "Director",
    bio: { "en-US": doc("Films by Agnès Varda on this season's programme.") },
    bornIn: { lat: 50.8333, lng: 4.3667 },
  }); // Brussels
  await addPerson({
    name: "Claire Denis",
    slug: "claire-denis",
    role: "Director",
    bio: { "en-US": doc("Films by Claire Denis on this season's programme.") },
    bornIn: { lat: 48.8566, lng: 2.3522 },
  }); // Paris
  await addPerson({
    name: "Edward Yang",
    slug: "edward-yang",
    role: "Director",
    bio: { "en-US": doc("Films by Edward Yang on this season's programme.") },
    bornIn: { lat: 31.2304, lng: 121.4737 },
  }); // Shanghai
  await addPerson({
    name: "Glauber Rocha",
    slug: "glauber-rocha",
    role: "Director",
    bio: { "en-US": doc("Films by Glauber Rocha on this season's programme.") },
    bornIn: { lat: -14.8661, lng: -40.8394 },
  }); // Vitória da Conquista
  await addPerson({
    name: "Werner Herzog",
    slug: "werner-herzog",
    role: "Director",
    bio: { "en-US": doc("Films by Werner Herzog on this season's programme.") },
    bornIn: { lat: 48.1351, lng: 11.582 },
  }); // Munich
  await addPerson({
    name: "Abbas Kiarostami",
    slug: "abbas-kiarostami",
    role: "Director",
    bio: { "en-US": doc("Films by Abbas Kiarostami on this season's programme.") },
    bornIn: { lat: 35.6892, lng: 51.389 },
  }); // Tehran
  await addPerson({
    name: "Vittorio De Sica",
    slug: "vittorio-de-sica",
    role: "Director",
    bio: { "en-US": doc("Films by Vittorio De Sica on this season's programme.") },
    bornIn: { lat: 41.7167, lng: 13.6167 },
  }); // Sora

  // The house team — the people who choose the programme and run the projector.
  await addPerson({
    name: "Ana Sofia Cardoso",
    slug: "ana-sofia-cardoso",
    role: "Programmer",
    bio: {
      "en-US": doc("Programmes the restored-classics strand and introduces most of it."),
      "pt-PT": doc("Programa o ciclo de clássicos restaurados e apresenta quase todas as sessões."),
    },
    bornIn: { lat: 38.7223, lng: -9.1393 },
  });
  await addPerson({
    name: "Rui Themido",
    slug: "rui-themido",
    role: "Programmer",
    bio: { "en-US": doc("New arthouse, the esplanade season, and the monthly Q&A.") },
    bornIn: { lat: 41.1579, lng: -8.6291 },
  });
  await addPerson({
    name: "Nuno Barreto",
    slug: "nuno-barreto",
    role: "Projectionist",
    bio: { "en-US": doc("Keeps the two 35mm projectors alive. Threads every print himself.") },
    bornIn: { lat: 40.2033, lng: -8.4103 },
  });

  // --- Films ---
  const film: Record<string, string> = {};
  async function addFilm(input: Record<string, unknown>): Promise<void> {
    const row = (await database.create("films", input)) as { id: string };
    film[input.slug as string] = row.id;
  }

  await addFilm({
    title: { "en-US": "Vertigo", "pt-PT": "A Mulher que Viveu Duas Vezes" },
    slug: "vertigo",
    originalTitle: "Vertigo",
    synopsis: {
      "en-US":
        "A former San Francisco police detective juggles wrestling with his personal demons and becoming obsessed with the hauntingly beautiful woman he has been hired to trail, who may be deeply disturbed.",
      "pt-PT":
        "Um detetive reformado, com medo das alturas, é contratado para seguir a mulher de um velho amigo.",
    },
    notes: {
      "en-US": doc(
        "Hitchcock shot the spiral into the film itself: the dolly-zoom down the bell tower was invented for this picture and has been borrowed ever since.",
        "The 1996 restoration recovered the Technicolor and, with it, the green light Madeleine keeps stepping out of.",
      ),
    },
    poster: image(
      "poster-tt0052357",
      "https://images.metahub.space/poster/medium/tt0052357/img",
      51860,
      "Vertigo poster",
    ),
    still: image(
      "still-tt0052357",
      "https://images.metahub.space/background/medium/tt0052357/img",
      465990,
      "Vertigo still",
    ),
    director: person["alfred-hitchcock"],
    year: 1958,
    runtime: 128,
    country: "United States",
    formats: ["70mm", "Digital restoration"],
    certificate: "12",
    status: "showing",
    featured: true,
    accentColor: "#1f6f3f",
    shotIn: { lat: 37.7749, lng: -122.4194 }, // San Francisco
  });
  await addFilm({
    title: { "en-US": "Os Verdes Anos", "pt-PT": "Os Verdes Anos" },
    slug: "os-verdes-anos",
    originalTitle: "Os Verdes Anos",
    synopsis: {
      "en-US":
        "19-year-old Julio has just left the provinces to settle down in the outskirts of Lisbon. He lives in a poor area with his uncle Afonso and starts working as an apprentice shoemaker. At the shop he gets to know Ilda, a young housem...",
      "pt-PT":
        "Um aprendiz de sapateiro chega a Lisboa e apaixona-se por uma criada. A cidade não lhes dá lugar.",
    },
    notes: {
      "en-US": doc(
        "Rocha's first feature, and the film that opened Portuguese cinema to the modern world — a shoemaker's apprentice and a maid meet in a Lisbon still under Salazar.",
        "We are showing the Cinemateca's restoration. The city in it is four streets from this cinema.",
      ),
    },
    poster: image(
      "poster-tt0057642",
      "https://images.metahub.space/poster/medium/tt0057642/img",
      136531,
      "Os Verdes Anos poster",
    ),
    still: image(
      "still-tt0057642",
      "https://images.metahub.space/background/medium/tt0057642/img",
      230895,
      "Os Verdes Anos still",
    ),
    director: person["paulo-rocha"],
    year: 1963,
    runtime: 91,
    country: "Portugal",
    formats: ["35mm", "Digital restoration"],
    certificate: "12",
    status: "showing",
    featured: false,
    accentColor: "#2f6f8f",
    shotIn: { lat: 38.7223, lng: -9.1393 }, // Lisbon
  });
  await addFilm({
    title: { "en-US": "Tabu", "pt-PT": "Tabu" },
    slug: "tabu",
    originalTitle: "Tabu",
    synopsis: {
      "en-US":
        "A restless retired woman teams up with her deceased neighbor's maid to seek out a man who has a secret connection to her past life as a farm owner at the foothill of Mount Tabu in Africa.",
      "pt-PT":
        "Uma velha senhora em Lisboa, uma criada cabo-verdiana e uma história de amor numa colónia africana.",
    },
    notes: {
      "en-US": doc(
        "A Lisbon flat, a Portuguese colony, and a love story told entirely without synchronous sound in its second half.",
        "Gomes shot the present in 35mm and the past in 16mm, so the grain itself tells you which country you are in.",
      ),
    },
    poster: image(
      "poster-tt2153963",
      "https://images.metahub.space/poster/medium/tt2153963/img",
      52178,
      "Tabu poster",
    ),
    still: image(
      "still-tt2153963",
      "https://images.metahub.space/background/medium/tt2153963/img",
      182587,
      "Tabu still",
    ),
    director: person["miguel-gomes"],
    year: 2012,
    runtime: 120,
    country: "Portugal",
    formats: ["35mm", "16mm", "DCP"],
    certificate: "12",
    status: "showing",
    featured: true,
    accentColor: "#8a6a3f",
    shotIn: { lat: 38.7223, lng: -9.1393 }, // Lisbon
  });
  await addFilm({
    title: { "en-US": "Touki Bouki" },
    slug: "touki-bouki",
    originalTitle: "Touki Bouki",
    synopsis: {
      "en-US":
        "Mory, a cowherd, and Anta, a university student, try to make money in order to go to Paris and leave their boring past behind.",
    },
    notes: {
      "en-US": doc(
        "Mory and Anta want Paris. Mambéty gives them a motorbike with zebu horns and a Dakar that refuses to let them leave.",
        "Restored by the World Cinema Project. The soundtrack still sounds like nothing else made in 1973.",
      ),
    },
    poster: image(
      "poster-tt0070820",
      "https://images.metahub.space/poster/medium/tt0070820/img",
      60927,
      "Touki Bouki poster",
    ),
    still: image(
      "still-tt0070820",
      "https://images.metahub.space/background/medium/tt0070820/img",
      211928,
      "Touki Bouki still",
    ),
    director: person["djibril-diop-mambety"],
    year: 1973,
    runtime: 91,
    country: "Senegal",
    formats: ["Digital restoration"],
    certificate: "16",
    status: "showing",
    featured: true,
    accentColor: "#c2452d",
    shotIn: { lat: 14.7167, lng: -17.4677 }, // Dakar
  });
  await addFilm({
    title: { "en-US": "Tokyo Story", "pt-PT": "Viagem a Tóquio" },
    slug: "tokyo-story",
    originalTitle: "Tokyo Story",
    synopsis: {
      "en-US":
        "An old couple visit their children and grandchildren in the city, but receive little attention.",
    },
    notes: {
      "en-US": doc(
        "An old couple travel to see children who have no time for them. Ozu never moves the camera and never needs to.",
        "Shown from a digital restoration of the Shochiku negative.",
      ),
    },
    poster: image(
      "poster-tt0046438",
      "https://images.metahub.space/poster/medium/tt0046438/img",
      37360,
      "Tokyo Story poster",
    ),
    still: image(
      "still-tt0046438",
      "https://images.metahub.space/background/medium/tt0046438/img",
      305387,
      "Tokyo Story still",
    ),
    director: person["yasujiro-ozu"],
    year: 1953,
    runtime: 137,
    country: "Japan",
    formats: ["35mm", "Digital restoration"],
    certificate: "U",
    status: "showing",
    featured: false,
    accentColor: "#5a5f6b",
    shotIn: { lat: 34.4088, lng: 133.205 }, // Onomichi
  });
  await addFilm({
    title: { "en-US": "Cléo from 5 to 7", "pt-PT": "Cléo das 5 às 7" },
    slug: "cleo-from-5-to-7",
    originalTitle: "Cléo from 5 to 7",
    synopsis: {
      "en-US":
        "Cleo, a singer and hypochondriac, becomes increasingly worried that she might have cancer while awaiting test results from her doctor.",
    },
    notes: {
      "en-US": doc(
        "Ninety minutes in near real time, following a singer through Paris while she waits for a diagnosis.",
        "Varda called it a film about a woman learning to look instead of be looked at.",
      ),
    },
    poster: image(
      "poster-tt0055852",
      "https://images.metahub.space/poster/medium/tt0055852/img",
      81359,
      "Cléo from 5 to 7 poster",
    ),
    still: image(
      "still-tt0055852",
      "https://images.metahub.space/background/medium/tt0055852/img",
      97008,
      "Cléo from 5 to 7 still",
    ),
    director: person["agnes-varda"],
    year: 1962,
    runtime: 90,
    country: "France",
    formats: ["35mm", "DCP"],
    certificate: "12",
    status: "programmed",
    featured: false,
    accentColor: "#c9536b",
    shotIn: { lat: 48.8566, lng: 2.3522 }, // Paris
  });
  await addFilm({
    title: { "en-US": "Beau Travail" },
    slug: "beau-travail",
    originalTitle: "Beau Travail",
    synopsis: {
      "en-US":
        "An ex-Foreign Legion officer recalls his once-glorious life of leading troops in Djibouti.",
    },
    notes: {
      "en-US": doc(
        "Denis takes Melville's Billy Budd to a Foreign Legion post in Djibouti and turns drill into choreography.",
        "The last two minutes are among the greatest endings in cinema. Stay for them.",
      ),
    },
    poster: image(
      "poster-tt0209933",
      "https://images.metahub.space/poster/medium/tt0209933/img",
      57511,
      "Beau Travail poster",
    ),
    still: image(
      "still-tt0209933",
      "https://images.metahub.space/background/medium/tt0209933/img",
      88126,
      "Beau Travail still",
    ),
    director: person["claire-denis"],
    year: 1999,
    runtime: 93,
    country: "France",
    formats: ["35mm", "Digital restoration"],
    certificate: "16",
    status: "programmed",
    featured: false,
    accentColor: "#c98a3f",
    shotIn: { lat: 11.5721, lng: 43.1456 }, // Djibouti
  });
  await addFilm({
    title: { "en-US": "A Brighter Summer Day" },
    slug: "a-brighter-summer-day",
    originalTitle: "A Brighter Summer Day",
    synopsis: {
      "en-US":
        "Based on a true story, primarily on a conflict between two youth gangs, a 14-year-old boy's girlfriend conflicts with the head of one gang for an unclear reason, until finally the conflict comes to a violent climax.",
    },
    notes: {
      "en-US": doc(
        "Four hours, a Taipei youth gang, and the weight of an exiled generation on teenagers who did not choose it.",
        "There will be one interval. The 4K restoration is the only way to see the night scenes.",
      ),
    },
    poster: image(
      "poster-tt0101985",
      "https://images.metahub.space/poster/medium/tt0101985/img",
      89277,
      "A Brighter Summer Day poster",
    ),
    still: image(
      "still-tt0101985",
      "https://images.metahub.space/background/medium/tt0101985/img",
      196059,
      "A Brighter Summer Day still",
    ),
    director: person["edward-yang"],
    year: 1991,
    runtime: 237,
    country: "Taiwan",
    formats: ["Digital restoration"],
    certificate: "16",
    status: "programmed",
    featured: true,
    accentColor: "#2d4a7a",
    shotIn: { lat: 25.033, lng: 121.5654 }, // Taipei
  });
  await addFilm({
    title: { "en-US": "Black God, White Devil", "pt-PT": "Deus e o Diabo na Terra do Sol" },
    slug: "black-god-white-devil",
    originalTitle: "Black God, White Devil",
    synopsis: {
      "en-US":
        "After killing his employer when he tries to cheat him out of his payment, a man becomes an outlaw and starts following a self-proclaimed saint.",
    },
    notes: {
      "en-US": doc(
        "Cinema Novo at full voice: a cowherd, a prophet, a bandit, and the drought that drives all three.",
        "Rocha wanted a cinema of hunger. This is what he meant.",
      ),
    },
    poster: image(
      "poster-tt0058006",
      "https://images.metahub.space/poster/medium/tt0058006/img",
      57292,
      "Black God, White Devil poster",
    ),
    still: image(
      "still-tt0058006",
      "https://images.metahub.space/background/medium/tt0058006/img",
      56754,
      "Black God, White Devil still",
    ),
    director: person["glauber-rocha"],
    year: 1964,
    runtime: 120,
    country: "Brazil",
    formats: ["35mm"],
    certificate: "16",
    status: "programmed",
    featured: false,
    accentColor: "#8f3a24",
    shotIn: { lat: -10.4358, lng: -39.3325 }, // Monte Santo, Bahia
  });
  await addFilm({
    title: { "en-US": "Aguirre, the Wrath of God", "pt-PT": "Aguirre, a Cólera dos Deuses" },
    slug: "aguirre-the-wrath-of-god",
    originalTitle: "Aguirre, the Wrath of God",
    synopsis: {
      "en-US":
        "In the 16th century, the ruthless and insane Don Lope de Aguirre leads a Spanish expedition in search of El Dorado.",
    },
    notes: {
      "en-US": doc(
        "Herzog took a camera up the Urubamba with a crew who half expected not to come back, and came back with this.",
        "Kinski is the reason people remember it. The river is the reason it works.",
      ),
    },
    poster: image(
      "poster-tt0068182",
      "https://images.metahub.space/poster/medium/tt0068182/img",
      130101,
      "Aguirre, the Wrath of God poster",
    ),
    still: image(
      "still-tt0068182",
      "https://images.metahub.space/background/medium/tt0068182/img",
      130392,
      "Aguirre, the Wrath of God still",
    ),
    director: person["werner-herzog"],
    year: 1972,
    runtime: 95,
    country: "Germany",
    formats: ["35mm", "DCP"],
    certificate: "16",
    status: "showing",
    featured: false,
    accentColor: "#3f5f3a",
    shotIn: { lat: -13.1631, lng: -72.545 }, // Urubamba, Peru
  });
  await addFilm({
    title: { "en-US": "Close-Up" },
    slug: "close-up",
    originalTitle: "Close-Up",
    synopsis: {
      "en-US":
        "The true story of Hossain Sabzian, a cinephile who impersonated the director Mohsen Makhmalbaf to convince a family they would star in his so-called new film.",
    },
    notes: {
      "en-US": doc(
        "A man impersonates a film director. Kiarostami films the trial, then asks everyone involved to play themselves.",
        "Still the most generous film ever made about why people go to the cinema.",
      ),
    },
    poster: image(
      "poster-tt0100234",
      "https://images.metahub.space/poster/medium/tt0100234/img",
      171131,
      "Close-Up poster",
    ),
    still: image(
      "still-tt0100234",
      "https://images.metahub.space/background/medium/tt0100234/img",
      166597,
      "Close-Up still",
    ),
    director: person["abbas-kiarostami"],
    year: 1990,
    runtime: 98,
    country: "Iran",
    formats: ["16mm", "Digital restoration"],
    certificate: "U",
    status: "draft",
    featured: false,
    accentColor: "#7a6a52",
    shotIn: { lat: 35.6892, lng: 51.389 }, // Tehran
  });
  await addFilm({
    title: { "en-US": "Bicycle Thieves", "pt-PT": "Ladrões de Bicicletas" },
    slug: "bicycle-thieves",
    originalTitle: "Bicycle Thieves",
    synopsis: {
      "en-US":
        "In post-war Italy, a working-class man's bicycle is stolen, endangering his efforts to find work. He and his son set out to find it.",
      "pt-PT": "Um pai e um filho procuram, por Roma, a bicicleta sem a qual não há trabalho.",
    },
    notes: {
      "en-US": doc(
        "A father, a son, and a stolen bicycle in a Rome with no work in it.",
        "Neorealism's plainest film and its most durable one.",
      ),
    },
    poster: image(
      "poster-tt0040522",
      "https://images.metahub.space/poster/medium/tt0040522/img",
      47294,
      "Bicycle Thieves poster",
    ),
    still: image(
      "still-tt0040522",
      "https://images.metahub.space/background/medium/tt0040522/img",
      676270,
      "Bicycle Thieves still",
    ),
    director: person["vittorio-de-sica"],
    year: 1948,
    runtime: 89,
    country: "Italy",
    formats: ["35mm", "Digital restoration"],
    certificate: "U",
    status: "draft",
    featured: false,
    accentColor: "#4a4a52",
    shotIn: { lat: 41.9028, lng: 12.4964 }, // Rome
  });

  // --- Screenings: five weeks of the programme ---
  const showings: Array<{
    slug: string;
    title: string;
    runtime: number;
    day: number;
    hour: number;
    minute?: number;
    screen: string;
    presentation: string;
    host?: string;
    status: string;
    soldOut?: boolean;
    note?: Record<string, string>;
  }> = [
    {
      slug: "vertigo",
      title: "Vertigo",
      runtime: 128,
      day: 2,
      hour: 21,
      minute: 0,
      screen: "Sala Grande",
      presentation: "Introduced",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      note: {
        "en-US": "Introduced by Ana Sofia Cardoso. 70mm print.",
        "pt-PT": "Apresentação de Ana Sofia Cardoso. Cópia em 70mm.",
      },
    },
    {
      slug: "touki-bouki",
      title: "Touki Bouki",
      runtime: 91,
      day: 3,
      hour: 19,
      minute: 30,
      screen: "Esplanada",
      presentation: "Regular",
      status: "on-sale",
      soldOut: true,
    },
    {
      slug: "tabu",
      title: "Tabu",
      runtime: 120,
      day: 4,
      hour: 18,
      minute: 30,
      screen: "Sala Azul",
      presentation: "Regular",
      status: "on-sale",
    },
    {
      slug: "os-verdes-anos",
      title: "Os Verdes Anos",
      runtime: 91,
      day: 5,
      hour: 21,
      minute: 0,
      screen: "Sala Grande",
      presentation: "Q&A",
      host: "rui-themido",
      status: "on-sale",
      note: {
        "en-US": "A conversation on Portuguese cinema of the sixties follows the screening.",
        "pt-PT": "Segue-se uma conversa sobre o cinema português dos anos sessenta.",
      },
    },
    {
      slug: "tokyo-story",
      title: "Tokyo Story",
      runtime: 137,
      day: 7,
      hour: 18,
      minute: 0,
      screen: "Sala Grande",
      presentation: "Regular",
      status: "on-sale",
    },
    {
      slug: "aguirre-the-wrath-of-god",
      title: "Aguirre, the Wrath of God",
      runtime: 95,
      day: 9,
      hour: 21,
      minute: 30,
      screen: "Sala Azul",
      presentation: "Introduced",
      host: "nuno-barreto",
      status: "on-sale",
      note: { "en-US": "On projecting a print that has been round the world twice." },
    },
    {
      slug: "vertigo",
      title: "Vertigo",
      runtime: 128,
      day: 11,
      hour: 18,
      minute: 30,
      screen: "Sala Grande",
      presentation: "Regular",
      status: "on-sale",
      soldOut: true,
    },
    {
      slug: "cleo-from-5-to-7",
      title: "Cléo from 5 to 7",
      runtime: 90,
      day: 13,
      hour: 19,
      minute: 0,
      screen: "Sala Azul",
      presentation: "Double bill",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      note: {
        "en-US": "Paired with Beau Travail. One ticket, both films.",
        "pt-PT": "Em dupla sessão com Beau Travail. Um bilhete, dois filmes.",
      },
    },
    {
      slug: "beau-travail",
      title: "Beau Travail",
      runtime: 93,
      day: 13,
      hour: 21,
      minute: 0,
      screen: "Sala Azul",
      presentation: "Double bill",
      status: "on-sale",
    },
    {
      slug: "touki-bouki",
      title: "Touki Bouki",
      runtime: 91,
      day: 17,
      hour: 20,
      minute: 0,
      screen: "Sala Grande",
      presentation: "Introduced",
      host: "rui-themido",
      status: "on-sale",
    },
    {
      slug: "a-brighter-summer-day",
      title: "A Brighter Summer Day",
      runtime: 237,
      day: 20,
      hour: 17,
      minute: 0,
      screen: "Sala Grande",
      presentation: "Introduced",
      host: "rui-themido",
      status: "on-sale",
      note: {
        "en-US": "Four hours with one interval. Bring water.",
        "pt-PT": "Quatro horas com um intervalo.",
      },
    },
    {
      slug: "black-god-white-devil",
      title: "Black God, White Devil",
      runtime: 120,
      day: 24,
      hour: 21,
      minute: 0,
      screen: "Esplanada",
      presentation: "Regular",
      status: "cancelled",
      note: {
        "en-US": "Cancelled — the print did not arrive in time.",
        "pt-PT": "Cancelado — a cópia não chegou a tempo.",
      },
    },
    {
      slug: "tokyo-story",
      title: "Tokyo Story",
      runtime: 137,
      day: 28,
      hour: 18,
      minute: 30,
      screen: "Sala Azul",
      presentation: "Regular",
      status: "draft",
    },
    {
      slug: "close-up",
      title: "Close-Up",
      runtime: 98,
      day: 31,
      hour: 19,
      minute: 30,
      screen: "Sala Azul",
      presentation: "Members only",
      status: "draft",
    },
  ];

  for (const s of showings) {
    const startsAt = daysFromNow(s.day, s.hour, s.minute ?? 0);
    await database.create("screenings", {
      label: labelFor(s.title, startsAt),
      film: film[s.slug],
      startsAt,
      endsAt: endOf(startsAt, s.runtime),
      screen: s.screen,
      presentation: s.presentation,
      ...(s.host ? { host: person[s.host] } : {}),
      status: s.status,
      soldOut: s.soldOut ?? false,
      ticketUrl: `https://bilheteira.cinemavertigo.pt/${s.slug}`,
      ...(s.note ? { note: s.note } : {}),
    });
  }

  // --- Journal ---
  await database.create("journal", {
    title: {
      "en-US": "The green light in Vertigo, and how we got it back",
      "pt-PT": "A luz verde em Vertigo, e como a recuperámos",
    },
    slug: "green-light-in-vertigo",
    excerpt: {
      "en-US":
        "What the 1996 restoration recovered, and why the colour matters more than the plot.",
      "pt-PT":
        "O que a restauração de 1996 recuperou, e porque a cor importa mais do que o enredo.",
    },
    body: {
      "en-US": doc(
        "Every print of Vertigo that circulated between 1958 and the early nineties had drifted. The Technicolor separations were intact, but nobody had gone back to them.",
        "Madeleine steps out of green light three times in the film. On a faded print you register it as fog. Restored, it reads as what Hitchcock meant: she is arriving from somewhere else.",
      ),
      "pt-PT": doc(
        "Todas as cópias de Vertigo que circularam entre 1958 e o início dos anos noventa tinham desviado de cor.",
        "Madeleine sai da luz verde três vezes no filme. Numa cópia gasta, parece nevoeiro. Restaurada, lê-se como Hitchcock queria.",
      ),
    },
    author: person["ana-sofia-cardoso"],
    aboutFilm: film.vertigo,
    tags: ["Restoration", "Programme note"],
    status: "published",
    publishedAt: daysFromNow(-9, 11),
  });

  await database.create("journal", {
    title: { "en-US": "Mambéty's motorbike: Touki Bouki at fifty" },
    slug: "mambety-motorbike",
    excerpt: {
      "en-US": "A Dakar road movie that refuses the road, restored by the World Cinema Project.",
    },
    body: {
      "en-US": doc(
        "Mory's motorbike has zebu horns on the handlebars. It is the first image of the film and the only thing in it that goes anywhere.",
        "Fifty years on, what still startles is the cutting: Mambéty edits against the sound, so Dakar arrives a beat before you are ready for it.",
      ),
    },
    author: person["rui-themido"],
    aboutFilm: film["touki-bouki"],
    tags: ["Essay", "Restoration"],
    status: "published",
    publishedAt: daysFromNow(-4, 10),
  });

  await database.create("journal", {
    title: {
      "en-US": "Four streets from here: Os Verdes Anos and the city it filmed",
      "pt-PT": "A quatro ruas daqui: Os Verdes Anos e a cidade que filmou",
    },
    slug: "os-verdes-anos-lisbon",
    excerpt: {
      "en-US": "Paulo Rocha shot a Lisbon that is still standing, mostly.",
      "pt-PT": "Paulo Rocha filmou uma Lisboa que ainda está de pé, quase toda.",
    },
    body: {
      "en-US": doc(
        "The film opens on a boy arriving from the country. The bus sets him down a short walk from where you are sitting.",
        "We have marked the locations on a map in the foyer. Six of the nine are unchanged.",
      ),
      "pt-PT": doc(
        "O filme abre com um rapaz que chega da província. O autocarro deixa-o a poucos passos daqui.",
        "Marcámos os locais num mapa no átrio. Seis dos nove estão como estavam.",
      ),
    },
    author: person["ana-sofia-cardoso"],
    aboutFilm: film["os-verdes-anos"],
    tags: ["Programme note", "Season"],
    status: "published",
    publishedAt: daysFromNow(-1, 16),
  });

  await database.create("journal", {
    title: { "en-US": "Autumn season: what we are planning" },
    slug: "autumn-season",
    excerpt: {
      "en-US": "Six weeks of Taiwanese cinema, and a 35mm strand we are still chasing prints for.",
    },
    body: {
      "en-US": doc(
        "A Brighter Summer Day anchors it. Around it we want Hou, Tsai, and if the print exists, Wan Jen.",
        "This is a draft. If you have a suggestion, the box office has a notebook for exactly this.",
      ),
    },
    author: person["rui-themido"],
    aboutFilm: film["a-brighter-summer-day"],
    tags: ["Season"],
    status: "review",
    publishedAt: daysFromNow(6, 9),
  });

  await database.create("journal", {
    title: { "en-US": "On projecting a film that has been round the world twice" },
    slug: "projecting-a-travelled-print",
    excerpt: {
      "en-US": "Our projectionist on splices, vinegar syndrome, and why we still thread 35mm.",
    },
    body: {
      "en-US": doc(
        "The Aguirre print has forty-one splices. I have counted them twice, which tells you something about my evenings.",
        "A digital file does not smell of anything. This one smells faintly of vinegar, which means it is dying, which means you should come and see it.",
      ),
    },
    author: person["nuno-barreto"],
    aboutFilm: film["aguirre-the-wrath-of-god"],
    tags: ["Essay"],
    status: "draft",
  });
}
