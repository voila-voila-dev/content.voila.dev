// Sample content for a fresh sandbox. Each visitor's Durable Object calls this
// once, right after it creates its schema, so the admin opens on a populated
// project instead of empty lists — a repertory season of films across statuses
// (Kanban), shooting locations on the map (geo), five weeks of showtimes
// (Calendar), the people who made and programme them, and a written journal.
//
// Writes go straight through the runtime `Database` (no REST/validation layer),
// so values are plain JS — `encodeRow` serializes geo/datetime/localized/richText
// columns. Localized fields only need the DEFAULT locale (en-US); a `pt-PT`
// translation can land later, and a couple of fields here deliberately lack one.
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

export async function seedSandbox(database: Database): Promise<void> {
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
    address: "Rua dos Remédios 148, 1100-445 Lisboa, Portugal",
    location: { lat: 38.7142, lng: -9.1268 },
    openingHours: {
      "en-US": "Box office daily 15:00–23:00. Bar opens one hour before the first film.",
      "pt-PT":
        "Bilheteira todos os dias das 15:00 às 23:00. Bar abre uma hora antes do primeiro filme.",
    },
    contactEmail: "bilheteira@cinemavertigo.pt",
    instagram: "https://instagram.com/cinemavertigo",
  });

  // --- People (directors, programmers, one projectionist; bornIn → Map view) ---
  const people = [
    {
      name: "Ana Sofia Cardoso",
      slug: "ana-sofia-cardoso",
      role: "Programmer",
      bio: {
        "en-US": doc(
          "Ana Sofia has programmed Vertigo since it reopened in 2014. She built the cinema's restoration strand and still writes most of its programme notes.",
        ),
        "pt-PT": doc(
          "Ana Sofia programa o Vertigo desde a reabertura, em 2014. Criou o ciclo de restauros e continua a escrever quase todas as notas de programa.",
        ),
      },
      bornIn: { lat: 38.7223, lng: -9.1393 }, // Lisbon
      website: "https://cinemavertigo.pt/equipa/ana-sofia-cardoso",
    },
    {
      name: "Tomás Rebelo",
      slug: "tomas-rebelo",
      role: "Programmer",
      bio: {
        "en-US": doc(
          "Tomás handles the new-release side of the programme and the Friday late shows. Before Vertigo he ran a film club in Porto for eleven years.",
        ),
        "pt-PT": doc(
          "Tomás trata das estreias e das sessões de sexta à noite. Antes do Vertigo, dirigiu durante onze anos um cineclube no Porto.",
        ),
      },
      bornIn: { lat: 41.1579, lng: -8.6291 }, // Porto
    },
    {
      name: "Íris Lemos",
      slug: "iris-lemos",
      role: "Projectionist",
      bio: {
        "en-US": doc(
          "Íris keeps the two Ernemann projectors in Sala Grande running. If you have seen a clean 35mm change-over here, it was hers.",
        ),
        "pt-PT": doc(
          "Íris mantém a funcionar os dois projectores Ernemann da Sala Grande. Se viu aqui uma mudança de rolo impecável em 35mm, foi dela.",
        ),
      },
      bornIn: { lat: 40.2033, lng: -8.4103 }, // Coimbra
    },
    {
      name: "Helena Quintela",
      slug: "helena-quintela",
      role: "Director",
      bio: {
        "en-US": doc(
          "Portuguese director whose films return, decade after decade, to the same stretch of the Minho coast and the people who leave it.",
        ),
        "pt-PT": doc(
          "Realizadora portuguesa cujos filmes regressam, década após década, ao mesmo troço da costa minhota e a quem de lá parte.",
        ),
      },
      bornIn: { lat: 41.5454, lng: -8.4265 }, // Braga
    },
    {
      name: "Marguerite Devaux",
      slug: "marguerite-devaux",
      role: "Director",
      bio: {
        "en-US": doc(
          "A quiet fixture of French cinema for sixty years: dock-side melodramas in the 1960s, then a long silence, then two late masterpieces.",
        ),
        "pt-PT": doc(
          "Uma presença discreta no cinema francês há sessenta anos: melodramas portuários nos anos 60, depois um longo silêncio e, por fim, duas obras-primas tardias.",
        ),
      },
      bornIn: { lat: 48.8566, lng: 2.3522 }, // Paris
    },
    {
      name: "Kenji Aramaki",
      slug: "kenji-aramaki",
      role: "Director",
      bio: {
        "en-US": doc(
          "Studio contract director turned independent; his post-war Tokyo films are the reason this cinema owns a 70mm head.",
        ),
        "pt-PT": doc(
          "Realizador de estúdio que se tornou independente; os seus filmes sobre a Tóquio do pós-guerra são a razão pela qual esta sala tem um cabeçote de 70mm.",
        ),
      },
      bornIn: { lat: 35.6762, lng: 139.6503 }, // Tokyo
    },
    {
      name: "Ousmane Diagne",
      slug: "ousmane-diagne",
      role: "Director",
      bio: {
        "en-US": doc(
          "One of the great Senegalese film-makers of the 1970s, and the first whose negatives were fully restored in Dakar rather than in Europe.",
        ),
        "pt-PT": doc(
          "Um dos grandes cineastas senegaleses dos anos 70 e o primeiro cujos negativos foram integralmente restaurados em Dakar, e não na Europa.",
        ),
      },
      bornIn: { lat: 14.7167, lng: -17.4677 }, // Dakar
    },
    {
      name: "Lin Yu-Cheng",
      slug: "lin-yu-cheng",
      role: "Director",
      bio: {
        "en-US": doc(
          "Taipei's patient chronicler of adolescence, working in long takes and borrowed apartments since the New Wave.",
        ),
      },
      bornIn: { lat: 25.033, lng: 121.5654 }, // Taipei
    },
    {
      name: "Beatriz Salgado",
      slug: "beatriz-salgado",
      role: "Director",
      bio: {
        "en-US": doc(
          "Brazilian director and editor. Her films are built in the cutting room, from far more footage than any of them admit to.",
        ),
        "pt-PT": doc(
          "Realizadora e montadora brasileira. Os seus filmes são construídos na sala de montagem, a partir de muito mais material do que qualquer um deles confessa.",
        ),
      },
      bornIn: { lat: -23.5505, lng: -46.6333 }, // São Paulo
    },
  ];

  const personId: Record<string, string> = {};
  for (const p of people) {
    const row = (await database.create("people", p)) as { id: string };
    personId[p.slug] = row.id;
  }

  // --- Films (status → Kanban columns; shotIn → Map; the season itself) ---
  const films = [
    {
      key: "a-casa-de-vidro",
      title: { "en-US": "The Glass House", "pt-PT": "A Casa de Vidro" },
      slug: "the-glass-house",
      originalTitle: "A Casa de Vidro",
      synopsis: {
        "en-US":
          "A Lisbon family spends one long summer in a house they have already agreed to sell, pretending not to notice the buyers walking through the rooms.",
        "pt-PT":
          "Uma família lisboeta passa um longo verão numa casa que já concordou em vender, fingindo não ver os compradores que percorrem os quartos.",
      },
      notes: {
        "en-US": doc(
          "Quintela's second feature was shot in eleven days in a house on Rua dos Remédios, two doors from where you are sitting. The production could not afford to light the interiors, so the film waits for the sun and moves with it.",
          "Banned outright in 1968 and released, uncut, in 1975. This is the 2019 restoration from the original camera negative, which recovers the fourteen minutes the censor removed.",
        ),
        "pt-PT": doc(
          "A segunda longa-metragem de Quintela foi filmada em onze dias numa casa da Rua dos Remédios, a duas portas de onde está sentado. A produção não tinha dinheiro para iluminar os interiores, e por isso o filme espera pelo sol e move-se com ele.",
          "Proibido em 1968 e estreado, sem cortes, em 1975. Esta é a restauração de 2019 a partir do negativo original, que recupera os catorze minutos retirados pela censura.",
        ),
      },
      director: "helena-quintela",
      year: 1968,
      runtime: 94,
      country: "Portugal",
      formats: ["35mm", "Digital restoration"],
      certificate: "12",
      status: "showing",
      featured: true,
      accentColor: "#8e1b1b",
      shotIn: { lat: 38.7139, lng: -9.1267 }, // Alfama, Lisbon
    },
    {
      key: "le-dernier-quai",
      title: { "en-US": "The Last Quay", "pt-PT": "O Último Cais" },
      slug: "the-last-quay",
      originalTitle: "Le Dernier Quai",
      synopsis: {
        "en-US":
          "A dock foreman in Marseille agrees to hold a suitcase for one night, and spends the rest of his life explaining the decision.",
        "pt-PT":
          "Um contramestre das docas de Marselha aceita guardar uma mala por uma noite e passa o resto da vida a explicar essa decisão.",
      },
      notes: {
        "en-US": doc(
          "Devaux made this at twenty-nine, on a crew that had never taken a woman's direction before; the shoot is the stuff of legend and the film is better than the legend.",
          "Print courtesy of the Cinémathèque française — a 35mm struck in 1987, slightly warm, with the original optical soundtrack.",
        ),
        "pt-PT": doc(
          "Devaux realizou-o aos vinte e nove anos, com uma equipa que nunca antes recebera ordens de uma mulher; a rodagem tornou-se lendária e o filme é melhor do que a lenda.",
          "Cópia cedida pela Cinémathèque française — um 35mm tirado em 1987, ligeiramente quente, com a banda sonora óptica original.",
        ),
      },
      director: "marguerite-devaux",
      year: 1961,
      runtime: 108,
      country: "France",
      formats: ["35mm"],
      certificate: "PG",
      status: "programmed",
      featured: false,
      accentColor: "#1f2937",
      shotIn: { lat: 43.2965, lng: 5.3698 }, // Marseille
    },
    {
      key: "rain-over-shinbashi",
      title: { "en-US": "Rain Over Shinbashi", "pt-PT": "Chuva Sobre Shinbashi" },
      slug: "rain-over-shinbashi",
      originalTitle: "新橋の雨",
      synopsis: {
        "en-US":
          "Three nights in a Tokyo bar that is about to be demolished, told by the people who keep arriving after closing time.",
        "pt-PT":
          "Três noites num bar de Tóquio prestes a ser demolido, contadas por quem continua a chegar depois da hora de fecho.",
      },
      notes: {
        "en-US": doc(
          "Aramaki shot this on the studio's back lot in the winter of 1956, using rain towers borrowed from a samurai picture shooting next door. It is, by some distance, the wettest film in the season.",
          "The 4K restoration corrects a decades-old printing error that had cropped the top of every interior. Seeing the ceilings changes the film.",
        ),
        "pt-PT": doc(
          "Aramaki filmou-o no estúdio no inverno de 1956, com torres de chuva emprestadas por uma produção de samurais que decorria ao lado. É, de longe, o filme mais molhado desta temporada.",
          "A restauração 4K corrige um erro de tiragem com décadas que cortava o topo de todos os interiores. Ver os tectos muda o filme.",
        ),
      },
      director: "kenji-aramaki",
      year: 1957,
      runtime: 121,
      country: "Japan",
      formats: ["35mm", "Digital restoration"],
      certificate: "PG",
      status: "showing",
      featured: true,
      accentColor: "#274060",
      shotIn: { lat: 35.6656, lng: 139.7595 }, // Shinbashi, Tokyo
    },
    {
      key: "harmattan",
      title: { "en-US": "Harmattan", "pt-PT": "Harmatão" },
      slug: "harmattan",
      synopsis: {
        "en-US":
          "A civil servant returns to the village he left at fifteen, carrying a briefcase of forms nobody there has any use for.",
        "pt-PT":
          "Um funcionário público regressa à aldeia que deixou aos quinze anos, com uma pasta cheia de formulários que ali não servem a ninguém.",
      },
      notes: {
        "en-US": doc(
          "Diagne financed Harmattan by selling his taxi, and shot it on short ends donated by a French crew that had wrapped in Dakar the week before.",
          "The negative sat in a Paris vault for thirty years. This restoration was completed in Dakar in 2022, with Diagne in the grading suite.",
        ),
        "pt-PT": doc(
          "Diagne financiou Harmatão vendendo o seu táxi e filmou-o com pontas de película oferecidas por uma equipa francesa que acabara de terminar em Dakar.",
          "O negativo esteve trinta anos num cofre em Paris. Esta restauração foi concluída em Dakar, em 2022, com Diagne presente na etalonagem.",
        ),
      },
      director: "ousmane-diagne",
      year: 1979,
      runtime: 96,
      country: "Senegal",
      formats: ["16mm", "Digital restoration"],
      certificate: "12",
      status: "programmed",
      featured: true,
      accentColor: "#b45309",
      shotIn: { lat: 14.6928, lng: -17.4467 }, // Dakar
    },
    {
      key: "the-long-vacation",
      title: { "en-US": "The Long Vacation", "pt-PT": "As Longas Férias" },
      slug: "the-long-vacation",
      originalTitle: "漫長的暑假",
      synopsis: {
        "en-US":
          "Two brothers are left alone in a Taipei apartment for a summer, and slowly rearrange it into somewhere their parents will not recognise.",
        "pt-PT":
          "Dois irmãos ficam sozinhos num apartamento de Taipé durante um verão e vão transformando-o num sítio que os pais não reconhecerão.",
      },
      notes: {
        "en-US": doc(
          "Lin's breakthrough runs 138 minutes and contains, by our count, nineteen shots. Nothing about it is slow.",
          "Screening from the director-approved DCP, with the corrected Mandarin and Taiwanese subtitle track that the 1994 export print lacked.",
        ),
        "pt-PT": doc(
          "A consagração de Lin dura 138 minutos e contém, pelas nossas contas, dezanove planos. Não tem nada de lento.",
          "Exibido a partir do DCP aprovado pelo realizador, com as legendas corrigidas que faltavam à cópia de exportação de 1994.",
        ),
      },
      director: "lin-yu-cheng",
      year: 1994,
      runtime: 138,
      country: "Taiwan",
      formats: ["DCP"],
      certificate: "PG",
      status: "programmed",
      featured: false,
      accentColor: "#0f766e",
      shotIn: { lat: 25.0478, lng: 121.5319 }, // Taipei
    },
    {
      key: "cinzas-de-verao",
      title: { "en-US": "Summer Ash", "pt-PT": "Cinzas de Verão" },
      slug: "summer-ash",
      originalTitle: "Cinzas de Verão",
      synopsis: {
        "en-US":
          "A Salvador wedding photographer starts keeping the frames she was paid to throw away, and finds a different city inside them.",
        "pt-PT":
          "Uma fotógrafa de casamentos de Salvador começa a guardar as imagens que lhe pagaram para deitar fora e encontra nelas uma outra cidade.",
      },
      notes: {
        "en-US": doc(
          "Salgado cut this from 140 hours of material shot across four years, most of it by people who are in the film.",
          "A late addition to the season and still marked provisional — we are waiting on the rights holder before we put tickets on sale.",
        ),
      },
      director: "beatriz-salgado",
      year: 2003,
      runtime: 102,
      country: "Brazil",
      formats: ["DCP"],
      certificate: "16",
      status: "draft",
      featured: false,
      accentColor: "#a16207",
      shotIn: { lat: -12.9777, lng: -38.5016 }, // Salvador
    },
    {
      key: "night-bus-to-braga",
      title: { "en-US": "Night Bus to Braga", "pt-PT": "Camioneta da Noite para Braga" },
      slug: "night-bus-to-braga",
      synopsis: {
        "en-US":
          "Fifty years after The Glass House, Quintela puts a daughter on the last bus north and refuses to tell us why she is going.",
        "pt-PT":
          "Cinquenta anos depois de A Casa de Vidro, Quintela põe uma filha na última camioneta para norte e recusa-se a dizer-nos porquê.",
      },
      notes: {
        "en-US": doc(
          "Shot digitally, at night, almost entirely inside a moving coach — and lit, Quintela insists, only by whatever the road provided.",
          "She will introduce the film in person on the 26th and stay for questions afterwards.",
        ),
        "pt-PT": doc(
          "Filmado em digital, de noite, quase inteiramente dentro de uma camioneta em andamento — e iluminado, insiste Quintela, apenas pelo que a estrada oferecia.",
          "A realizadora apresenta o filme no dia 26 e fica depois para conversar com o público.",
        ),
      },
      director: "helena-quintela",
      year: 2019,
      runtime: 88,
      country: "Portugal",
      formats: ["DCP"],
      certificate: "12",
      status: "showing",
      featured: false,
      accentColor: "#3f3d56",
      shotIn: { lat: 41.5454, lng: -8.4265 }, // Braga
    },
    {
      key: "sable",
      title: { "en-US": "Sand", "pt-PT": "Areia" },
      slug: "sand",
      originalTitle: "Sable",
      synopsis: {
        "en-US":
          "Devaux's last film: a widow walks into the Camargue with her husband's ashes and keeps walking for ninety minutes.",
        "pt-PT":
          "O último filme de Devaux: uma viúva entra na Camargue com as cinzas do marido e continua a andar durante noventa minutos.",
      },
      notes: {
        "en-US": doc(
          "Made at eighty-nine, sixty years after The Last Quay, with a crew of six. The two films are programmed a week apart on purpose.",
          "Presented in its original 1.66:1 ratio, with the wind mix the director supervised at IRCAM shortly before her death.",
        ),
        "pt-PT": doc(
          "Realizado aos oitenta e nove anos, sessenta anos depois de O Último Cais, com uma equipa de seis pessoas. Os dois filmes estão programados com uma semana de intervalo de propósito.",
          "Apresentado no formato original 1.66:1, com a mistura de som supervisionada pela realizadora no IRCAM pouco antes de morrer.",
        ),
      },
      director: "marguerite-devaux",
      year: 2021,
      runtime: 117,
      country: "France",
      formats: ["DCP", "Digital restoration"],
      certificate: "16",
      status: "programmed",
      featured: true,
      accentColor: "#c2410c",
      shotIn: { lat: 43.5283, lng: 4.4222 }, // Camargue
    },
    {
      key: "the-silent-wing",
      title: { "en-US": "The Silent Wing", "pt-PT": "A Asa Silenciosa" },
      slug: "the-silent-wing",
      originalTitle: "沈黙の翼",
      synopsis: {
        "en-US":
          "A crane researcher in eastern Hokkaido spends a winter counting birds that are no longer arriving.",
        "pt-PT":
          "Um investigador de grous no leste de Hokkaido passa um inverno a contar aves que já não chegam.",
      },
      notes: {
        "en-US": doc(
          "Aramaki was ninety-one when he made this, and shot it in 70mm because, he said, snow deserves the negative area.",
          "Our 70mm dates are provisional until the plates clear customs; the DCP is booked as a fallback.",
        ),
      },
      director: "kenji-aramaki",
      year: 2016,
      runtime: 134,
      country: "Japan",
      formats: ["70mm", "DCP"],
      certificate: "12",
      status: "draft",
      featured: false,
      accentColor: "#475569",
      shotIn: { lat: 42.9849, lng: 144.382 }, // Kushiro, Hokkaido
    },
    {
      key: "bright-river",
      title: { "en-US": "Bright River", "pt-PT": "Rio Claro" },
      slug: "bright-river",
      originalTitle: "明亮的溪",
      synopsis: {
        "en-US":
          "Thirty years on from The Long Vacation, Lin sends one of those brothers back to the east coast to sell his mother's house.",
        "pt-PT":
          "Trinta anos depois de As Longas Férias, Lin manda um daqueles irmãos de volta à costa leste para vender a casa da mãe.",
      },
      notes: {
        "en-US": doc(
          "New this season, straight from its festival run, and the first Lin film shot outside Taipei.",
          "Ana Sofia introduces the opening night; the director joins by video link for a short Q&A afterwards.",
        ),
        "pt-PT": doc(
          "Novidade desta temporada, vinda directamente do circuito de festivais, e o primeiro filme de Lin rodado fora de Taipé.",
          "Ana Sofia apresenta a sessão de estreia; o realizador junta-se por videochamada para uma breve conversa no final.",
        ),
      },
      director: "lin-yu-cheng",
      year: 2024,
      runtime: 110,
      country: "Taiwan",
      formats: ["DCP"],
      certificate: "PG",
      status: "programmed",
      featured: false,
      accentColor: "#15803d",
      shotIn: { lat: 23.9871, lng: 121.6015 }, // Hualien
    },
  ];

  const filmId: Record<string, string> = {};
  const filmTitle: Record<string, string> = {};
  const filmRuntime: Record<string, number> = {};
  for (const { key, director, ...film } of films) {
    const row = (await database.create("films", {
      ...film,
      director: personId[director],
    })) as { id: string };
    filmId[key] = row.id;
    filmTitle[key] = film.title["en-US"];
    filmRuntime[key] = film.runtime;
  }

  // --- Screenings (five weeks of showtimes → the Calendar view IS the programme) ---
  const showtimes = [
    {
      film: "a-casa-de-vidro",
      startsAt: daysFromNow(2, 21, 0),
      screen: "Sala Grande",
      presentation: "Introduced",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "Introduced by Ana Sofia Cardoso. 35mm restoration print.",
        "pt-PT": "Apresentação de Ana Sofia Cardoso. Cópia restaurada em 35mm.",
      },
    },
    {
      film: "rain-over-shinbashi",
      startsAt: daysFromNow(3, 18, 30),
      screen: "Sala Grande",
      presentation: "Regular",
      status: "on-sale",
      soldOut: false,
    },
    {
      film: "night-bus-to-braga",
      startsAt: daysFromNow(4, 19, 0),
      screen: "Sala Azul",
      presentation: "Regular",
      status: "on-sale",
      soldOut: true,
    },
    {
      film: "le-dernier-quai",
      startsAt: daysFromNow(6, 21, 30),
      screen: "Sala Grande",
      presentation: "Introduced",
      host: "tomas-rebelo",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "35mm print from the Cinémathèque française. Introduced by Tomás Rebelo.",
        "pt-PT": "Cópia em 35mm da Cinémathèque française. Apresentação de Tomás Rebelo.",
      },
    },
    {
      film: "harmattan",
      startsAt: daysFromNow(8, 20, 0),
      screen: "Esplanada",
      presentation: "Q&A",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "Outdoor screening, followed by a conversation about the Dakar restoration.",
        "pt-PT": "Sessão ao ar livre, seguida de uma conversa sobre a restauração feita em Dakar.",
      },
    },
    {
      film: "the-long-vacation",
      startsAt: daysFromNow(9, 17, 0),
      screen: "Sala Azul",
      presentation: "Regular",
      status: "on-sale",
      soldOut: false,
    },
    {
      film: "a-casa-de-vidro",
      startsAt: daysFromNow(11, 16, 0),
      screen: "Sala Grande",
      presentation: "Regular",
      status: "on-sale",
      soldOut: true,
    },
    {
      film: "bright-river",
      startsAt: daysFromNow(13, 21, 0),
      screen: "Sala Grande",
      presentation: "Q&A",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "Opening night. The director joins by video link after the screening.",
        "pt-PT": "Sessão de estreia. O realizador junta-se por videochamada após o filme.",
      },
    },
    {
      film: "sable",
      startsAt: daysFromNow(16, 19, 30),
      screen: "Sala Grande",
      presentation: "Double bill",
      host: "tomas-rebelo",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "Double bill with The Last Quay. One ticket, sixty years apart.",
        "pt-PT": "Sessão dupla com O Último Cais. Um bilhete, sessenta anos de intervalo.",
      },
    },
    {
      film: "rain-over-shinbashi",
      startsAt: daysFromNow(18, 21, 15),
      screen: "Sala Azul",
      presentation: "Members only",
      status: "cancelled",
      soldOut: false,
      note: {
        "en-US": "Cancelled — the print was damaged in transit. Ticket holders have been refunded.",
        "pt-PT":
          "Cancelada — a cópia foi danificada no transporte. Os bilhetes foram reembolsados.",
      },
    },
    {
      film: "night-bus-to-braga",
      startsAt: daysFromNow(20, 20, 0),
      screen: "Sala Grande",
      presentation: "Q&A",
      host: "ana-sofia-cardoso",
      status: "on-sale",
      soldOut: false,
      note: {
        "en-US": "Helena Quintela introduces the film and stays for questions.",
        "pt-PT": "Helena Quintela apresenta o filme e fica para responder a perguntas.",
      },
    },
    {
      film: "the-long-vacation",
      startsAt: daysFromNow(24, 18, 0),
      screen: "Esplanada",
      presentation: "Regular",
      status: "draft",
      soldOut: false,
    },
    {
      film: "the-silent-wing",
      startsAt: daysFromNow(27, 20, 30),
      screen: "Sala Grande",
      presentation: "Regular",
      status: "draft",
      soldOut: false,
    },
    {
      film: "harmattan",
      startsAt: daysFromNow(31, 19, 0),
      screen: "Sala Azul",
      presentation: "Introduced",
      host: "tomas-rebelo",
      status: "on-sale",
      soldOut: false,
    },
  ];

  for (const s of showtimes) {
    const { film, host, ...rest } = s;
    await database.create("screenings", {
      ...rest,
      label: labelFor(filmTitle[film], s.startsAt),
      film: filmId[film],
      endsAt: endOf(s.startsAt, filmRuntime[film]),
      ...(host ? { host: personId[host] } : {}),
      ticketUrl: `https://bilheteira.cinemavertigo.pt/${film}`,
    });
  }

  // --- Journal (essays and notes; status → Kanban, publishedAt → Calendar) ---
  const entries = [
    {
      title: {
        "en-US": "Fourteen minutes, returned",
        "pt-PT": "Catorze minutos devolvidos",
      },
      slug: "fourteen-minutes-returned",
      excerpt: {
        "en-US":
          "What the censor cut from The Glass House in 1968, and what it does to the film to have it back.",
        "pt-PT":
          "O que a censura cortou de A Casa de Vidro em 1968 e o que muda no filme tê-lo de volta.",
      },
      body: {
        "en-US": doc(
          "The 1975 release was described everywhere as uncut. It was not. Fourteen minutes had been removed at the negative in 1968, and nobody thought to check.",
          "Restored, the film is not more shocking — it is slower. The cuts had taken out the waiting, and the waiting was the point.",
        ),
        "pt-PT": doc(
          "A estreia de 1975 foi descrita em todo o lado como integral. Não era. Catorze minutos tinham sido retirados do negativo em 1968 e ninguém se lembrou de confirmar.",
          "Restaurado, o filme não é mais chocante — é mais lento. Os cortes tinham eliminado a espera, e a espera era o essencial.",
        ),
      },
      author: "ana-sofia-cardoso",
      aboutFilm: "a-casa-de-vidro",
      tags: ["Restoration", "Programme note"],
      status: "published",
      publishedAt: daysFromNow(-18, 10),
    },
    {
      title: {
        "en-US": "Marguerite Devaux, 1932–2024",
        "pt-PT": "Marguerite Devaux, 1932–2024",
      },
      slug: "marguerite-devaux-1932-2024",
      excerpt: {
        "en-US":
          "Sixty years between her first film and her last, and not one wasted frame in either.",
        "pt-PT": "Sessenta anos entre o primeiro e o último filme, e nem um plano desperdiçado.",
      },
      body: {
        "en-US": doc(
          "She was refused a union card twice before The Last Quay, and afterwards was never refused anything again except money.",
          "We are showing both ends of that career a week apart this month. Come to the double bill if you can only come once.",
        ),
        "pt-PT": doc(
          "Recusaram-lhe duas vezes a carteira profissional antes de O Último Cais; depois disso, nunca mais lhe recusaram nada — a não ser dinheiro.",
          "Este mês mostramos os dois extremos dessa carreira com uma semana de intervalo. Se só puder vir uma vez, venha à sessão dupla.",
        ),
      },
      author: "tomas-rebelo",
      aboutFilm: "sable",
      tags: ["Obituary", "Essay"],
      status: "published",
      publishedAt: daysFromNow(-9, 12),
    },
    {
      title: {
        "en-US": "Ousmane Diagne on restoring Harmattan in Dakar",
        "pt-PT": "Ousmane Diagne e a restauração de Harmatão em Dakar",
      },
      slug: "ousmane-diagne-interview",
      excerpt: {
        "en-US":
          '"The negative went to Paris in 1981 and I did not see it again for thirty years. I wanted it graded at home."',
        "pt-PT":
          "«O negativo foi para Paris em 1981 e não voltei a vê-lo durante trinta anos. Queria que fosse etalonado em casa.»",
      },
      body: {
        "en-US": doc(
          "We spoke to Diagne by phone in June, a few days after the restored print screened in Dakar for the first time.",
          "He was less interested in the film than in the four technicians he trained during the work, all of whom are still there.",
        ),
        "pt-PT": doc(
          "Falámos com Diagne por telefone em Junho, poucos dias depois de a cópia restaurada ter sido exibida em Dakar pela primeira vez.",
          "Interessava-lhe menos o filme do que os quatro técnicos que formou durante o trabalho, todos eles ainda lá.",
        ),
      },
      author: "ana-sofia-cardoso",
      aboutFilm: "harmattan",
      tags: ["Interview", "Restoration"],
      status: "published",
      publishedAt: daysFromNow(-3, 9),
    },
    {
      title: {
        "en-US": "Nineteen shots: notes on The Long Vacation",
        "pt-PT": "Dezanove planos: notas sobre As Longas Férias",
      },
      slug: "nineteen-shots",
      excerpt: {
        "en-US": "Lin's summer film is often called slow. We counted, and it is anything but.",
        "pt-PT":
          "O filme de verão de Lin é muitas vezes dito lento. Contámos, e é tudo menos isso.",
      },
      body: {
        "en-US": doc(
          "A long take is not a still one. In the sixth shot the camera crosses three rooms, two arguments and a decade of family history without cutting.",
          "Read this before the screening if you can; it gives away nothing, and it changes where you look.",
        ),
      },
      author: "tomas-rebelo",
      aboutFilm: "the-long-vacation",
      tags: ["Programme note", "Essay"],
      status: "review",
      publishedAt: daysFromNow(5, 10),
    },
    {
      title: {
        "en-US": "Autumn season: what we are planning",
        "pt-PT": "Temporada de outono: o que estamos a preparar",
      },
      slug: "autumn-season-planning",
      excerpt: {
        "en-US":
          "A 70mm week, one director in person, and a Brazilian strand we have not confirmed yet.",
        "pt-PT":
          "Uma semana em 70mm, uma realizadora em pessoa e um ciclo brasileiro ainda por confirmar.",
      },
      body: {
        "en-US": doc(
          "Draft, and genuinely provisional — the 70mm plates are still in transit and the Salgado rights are unresolved.",
          "Publishing this once both are settled. Do not link to it yet.",
        ),
      },
      author: "ana-sofia-cardoso",
      aboutFilm: "the-silent-wing",
      tags: ["Season"],
      status: "draft",
      publishedAt: daysFromNow(12, 10),
    },
  ];

  for (const e of entries) {
    const { author, aboutFilm, ...rest } = e;
    await database.create("journal", {
      ...rest,
      author: personId[author],
      aboutFilm: filmId[aboutFilm],
    });
  }
}
