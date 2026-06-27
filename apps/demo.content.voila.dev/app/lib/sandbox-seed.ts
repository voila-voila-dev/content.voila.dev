// Sample content for a fresh sandbox. Each visitor's Durable Object calls this
// once, right after it creates its schema, so the admin opens on a populated
// project instead of empty lists — posts across statuses (Kanban), points on the
// map (geo), dated items (Calendar), and a couple of authors + events.
//
// Writes go straight through the runtime `Database` (no REST/validation layer),
// so values are plain JS — `encodeRow` serializes geo/datetime/localized/richText
// columns. Localized fields must include every project locale (en-US, fr-FR).

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

/** Epoch ms, `days` from now (negative = past). */
function daysFromNow(days: number, hour = 9): number {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export async function seedSandbox(database: Database): Promise<void> {
  // --- Settings singleton ---
  await database.upsert("settings", {
    siteName: { "en-US": "Voilà Travels", "fr-FR": "Voilà Voyages" },
    tagline: {
      "en-US": "Stories, guides and gatherings from the road.",
      "fr-FR": "Récits, guides et rencontres depuis la route.",
    },
    primaryColor: "#2563eb",
    contactEmail: "hello@voila.travel",
  });

  // --- Authors ---
  const authors = [
    {
      name: "Maya Okonkwo",
      slug: "maya-okonkwo",
      role: "Editor",
      email: "maya@voila.travel",
      bio: doc("Maya leads our city desk and has filed dispatches from forty countries."),
      location: { lat: 51.5072, lng: -0.1276 }, // London
    },
    {
      name: "Liam Fraser",
      slug: "liam-fraser",
      role: "Writer",
      email: "liam@voila.travel",
      bio: doc("Liam writes about mountains, long trails and the meals at the end of them."),
      location: { lat: 45.4642, lng: 9.19 }, // Milan
    },
    {
      name: "Sofia Marchetti",
      slug: "sofia-marchetti",
      role: "Photographer",
      email: "sofia@voila.travel",
      bio: doc("Sofia shoots food and markets, mostly around the Mediterranean."),
      location: { lat: 41.3874, lng: 2.1686 }, // Barcelona
    },
    {
      name: "Noah Bergström",
      slug: "noah-bergstrom",
      role: "Contributor",
      email: "noah@voila.travel",
      bio: doc("Noah covers the outdoors and the slow way of getting anywhere."),
      location: { lat: 59.3293, lng: 18.0686 }, // Stockholm
    },
  ];
  for (const a of authors) await database.create("authors", a);

  // --- Posts (varied status → Kanban columns; geo → Map; publishedAt → Calendar) ---
  const posts = [
    {
      title: { "en-US": "48 Hours in Lisbon", "fr-FR": "48 heures à Lisbonne" },
      slug: "48-hours-in-lisbon",
      excerpt: {
        "en-US": "Trams, tiles and pastéis — a fast, full weekend in the Portuguese capital.",
        "fr-FR": "Tramways, azulejos et pastéis — un week-end complet dans la capitale portugaise.",
      },
      body: doc(
        "Lisbon rewards walkers who don't mind hills. Start in Alfama before the crowds.",
        "By evening, follow the sound of fado into a back-street tavern in Mouraria.",
      ),
      category: "City Guides",
      author: "Maya Okonkwo",
      status: "published",
      featured: true,
      readingMinutes: 7,
      accentColor: "#e11d48",
      location: { lat: 38.7223, lng: -9.1393 },
      publishedAt: daysFromNow(-12),
    },
    {
      title: { "en-US": "The Best Ramen in Tokyo", "fr-FR": "Les meilleurs ramen de Tokyo" },
      slug: "best-ramen-in-tokyo",
      excerpt: {
        "en-US": "Six bowls, six neighbourhoods, one very happy week.",
        "fr-FR": "Six bols, six quartiers, une semaine très heureuse.",
      },
      body: doc("From tonkotsu in Shinjuku to shio near the bay, this is our shortlist."),
      category: "Food",
      author: "Sofia Marchetti",
      status: "published",
      featured: false,
      readingMinutes: 9,
      accentColor: "#f59e0b",
      location: { lat: 35.6762, lng: 139.6503 },
      publishedAt: daysFromNow(-5),
    },
    {
      title: { "en-US": "Hiking the Dolomites", "fr-FR": "Randonnée dans les Dolomites" },
      slug: "hiking-the-dolomites",
      excerpt: {
        "en-US": "A three-day hut-to-hut loop with the best light we've ever seen.",
        "fr-FR": "Une boucle de trois jours de refuge en refuge sous une lumière inoubliable.",
      },
      body: doc("Book the rifugios early. The Tre Cime loop fills up months ahead in summer."),
      category: "Outdoors",
      author: "Liam Fraser",
      status: "review",
      featured: false,
      readingMinutes: 11,
      accentColor: "#10b981",
      location: { lat: 46.6188, lng: 12.3142 },
      publishedAt: daysFromNow(-2),
    },
    {
      title: { "en-US": "A Slow Day in Kyoto", "fr-FR": "Une journée lente à Kyoto" },
      slug: "slow-day-in-kyoto",
      excerpt: {
        "en-US": "Temples at dawn, tea at noon, and nowhere you have to be.",
        "fr-FR": "Temples à l'aube, thé à midi, et aucun rendez-vous.",
      },
      body: doc("Kyoto is best unscheduled. Pick one temple, then let the streets decide."),
      category: "Culture",
      author: "Maya Okonkwo",
      status: "draft",
      featured: false,
      readingMinutes: 6,
      accentColor: "#8b5cf6",
      location: { lat: 35.0116, lng: 135.7681 },
      publishedAt: daysFromNow(4),
    },
    {
      title: { "en-US": "Coffee Crawl in Melbourne", "fr-FR": "Tournée des cafés à Melbourne" },
      slug: "coffee-crawl-melbourne",
      excerpt: {
        "en-US": "The laneways that turned a city into a coffee capital.",
        "fr-FR": "Les ruelles qui ont fait d'une ville une capitale du café.",
      },
      body: doc("Skip the chains. The good stuff hides down Melbourne's graffiti-lined laneways."),
      category: "Food",
      author: "Sofia Marchetti",
      status: "draft",
      featured: false,
      readingMinutes: 5,
      accentColor: "#0ea5e9",
      location: { lat: -37.8136, lng: 144.9631 },
      publishedAt: daysFromNow(9),
    },
    {
      title: { "en-US": "Fjords by Ferry", "fr-FR": "Les fjords en ferry" },
      slug: "fjords-by-ferry",
      excerpt: {
        "en-US": "The cheapest, slowest, most beautiful way to see western Norway.",
        "fr-FR": "La façon la moins chère, la plus lente et la plus belle de voir la Norvège.",
      },
      body: doc("Local ferries cost a fraction of the cruises and stop where the views are."),
      category: "Travel",
      author: "Noah Bergström",
      status: "published",
      featured: true,
      readingMinutes: 8,
      accentColor: "#14b8a6",
      location: { lat: 60.472, lng: 8.4689 },
      publishedAt: daysFromNow(-20),
    },
  ];
  for (const p of posts) await database.create("posts", p);

  // --- Events (start/end → Calendar; venue location → Map) ---
  const events = [
    {
      title: { "en-US": "Travel Writing Workshop", "fr-FR": "Atelier d'écriture de voyage" },
      slug: "travel-writing-workshop",
      summary: {
        "en-US": "A hands-on afternoon turning notes into publishable stories.",
        "fr-FR": "Un après-midi pratique pour transformer ses notes en récits.",
      },
      description: doc("Bring a notebook from a recent trip. We'll edit live, together."),
      kind: "Workshop",
      status: "published",
      venue: "The Photographers' Gallery",
      location: { lat: 51.5152, lng: -0.1419 },
      startsAt: daysFromNow(7, 14),
      endsAt: daysFromNow(7, 17),
    },
    {
      title: { "en-US": "Readers' Meetup", "fr-FR": "Rencontre des lecteurs" },
      slug: "readers-meetup",
      summary: {
        "en-US": "Drinks and trip stories with the Voilà community.",
        "fr-FR": "Boissons et récits de voyage avec la communauté Voilà.",
      },
      description: doc("No agenda. Just maps on the table and someone who's been there."),
      kind: "Meetup",
      status: "published",
      venue: "Bar Marsella",
      location: { lat: 41.3793, lng: 2.1699 },
      startsAt: daysFromNow(14, 19),
      endsAt: daysFromNow(14, 22),
    },
    {
      title: { "en-US": "Slow Travel Conference", "fr-FR": "Conférence du voyage lent" },
      slug: "slow-travel-conference",
      summary: {
        "en-US": "A day of talks on travelling further by going slower.",
        "fr-FR": "Une journée de conférences sur l'art de voyager autrement.",
      },
      description: doc("Speakers from rail, sail and trail. Lunch included."),
      kind: "Conference",
      status: "draft",
      venue: "Stockholm Waterfront",
      location: { lat: 59.3326, lng: 18.0577 },
      startsAt: daysFromNow(28, 9),
      endsAt: daysFromNow(28, 18),
    },
    {
      title: { "en-US": "Alfama Food Tour", "fr-FR": "Tour gastronomique d'Alfama" },
      slug: "alfama-food-tour",
      summary: {
        "en-US": "Tastings through Lisbon's oldest neighbourhood.",
        "fr-FR": "Dégustations dans le plus vieux quartier de Lisbonne.",
      },
      description: doc("Six stops, three hours, and at least one pastel de nata."),
      kind: "Tour",
      status: "published",
      venue: "Largo do Chafariz de Dentro",
      location: { lat: 38.7139, lng: -9.1267 },
      startsAt: daysFromNow(3, 11),
      endsAt: daysFromNow(3, 14),
    },
  ];
  for (const e of events) await database.create("events", e);
}
