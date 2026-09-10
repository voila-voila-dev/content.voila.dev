// Visit: address, hours, contact, and the pin. The map is a static
// OpenStreetMap frame built from `settings.location` — no map library ships to
// the reader, and the coordinates are printed underneath so the page still
// works if the frame is blocked.

import { createFileRoute } from "@tanstack/react-router";
import { Eyebrow, PageHeader } from "../components/primitives";
import { RichText } from "../components/rich-text";
import { coordinates } from "../lib/format";
import { type Lang, strings } from "../lib/i18n";
import { fetchSite } from "../lib/queries";
import { useLang } from "../lib/use-lang";

export const Route = createFileRoute("/visit")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchSite({ data: { lang: deps.lang } }),
  component: Visit,
});

/** A framed OSM viewport around the pin — a static image would need a key. */
function mapSrc(lat: number, lng: number): string {
  const d = 0.006;
  const bbox = [lng - d, lat - d / 2, lng + d, lat + d / 2].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function Visit() {
  const { settings } = Route.useLoaderData();
  const lang = useLang();
  const t = strings(lang);

  return (
    <div className="pb-8">
      <PageHeader
        eyebrow={t.visit}
        title={settings?.siteName ?? "Cinéma Vertigo"}
        lead={settings?.tagline ?? undefined}
      />

      <div className="grid gap-12 py-12 md:grid-cols-[1fr_1fr] md:gap-16">
        <dl className="space-y-8">
          <div className="border-t border-rule pt-4">
            <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
              {t.address}
            </dt>
            <dd className="mt-3 whitespace-pre-line font-display text-2xl leading-snug">
              {settings?.address ?? "—"}
            </dd>
          </div>
          <div className="border-t border-rule pt-4">
            <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
              {t.openingHours}
            </dt>
            <dd className="mt-3 whitespace-pre-line text-base leading-relaxed text-dim">
              {settings?.openingHours ?? "—"}
            </dd>
          </div>
          <div className="border-t border-rule pt-4">
            <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
              {t.contact}
            </dt>
            <dd className="mt-3 space-y-1.5 text-base text-dim">
              {settings?.contactEmail ? (
                <p>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
                  >
                    {settings.contactEmail}
                  </a>
                </p>
              ) : null}
              {settings?.instagram ? (
                <p>
                  <a
                    href={settings.instagram}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-(--accent)"
                  >
                    Instagram
                  </a>
                </p>
              ) : null}
            </dd>
          </div>
          {settings?.location ? (
            <div className="border-t border-rule pt-4">
              <dt className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-faint">
                {t.coordinates}
              </dt>
              <dd className="mt-3 font-mono text-sm text-dim">{coordinates(settings.location)}</dd>
            </div>
          ) : null}
        </dl>

        <div>
          {settings?.location ? (
            <iframe
              title={t.findUs}
              src={mapSrc(settings.location.lat, settings.location.lng)}
              className="aspect-square w-full border border-rule grayscale"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center border border-rule bg-raised">
              <Eyebrow>{t.findUs}</Eyebrow>
            </div>
          )}
        </div>
      </div>

      {settings?.about ? (
        <section className="border-t border-rule py-12">
          <RichText value={settings.about} />
        </section>
      ) : null}
    </div>
  );
}
