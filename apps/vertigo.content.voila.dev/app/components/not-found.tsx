// The 404, in the house's own voice. Shared by the public shell's
// `notFoundComponent` (a slug that resolves to nothing) and the `_site` splat
// route (a URL nothing matches) so both read identically.

import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { strings } from "../lib/i18n";
import { useLang } from "../lib/use-lang";

export function NotFound(): ReactNode {
  const lang = useLang();
  const t = strings(lang);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <section className="py-24 sm:py-36">
      <p className="font-display text-[clamp(5rem,18vw,11rem)] leading-none text-(--accent)">404</p>
      <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3.2rem)] leading-tight">
        {t.notFoundTitle}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-dim">{t.notFoundBody}</p>
      <p className="mt-3 font-mono text-xs text-faint">{pathname}</p>
      <a
        href={lang === "en-US" ? "/" : `/?lang=${lang}`}
        className="mt-10 inline-block border border-(--accent) px-5 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-(--accent) transition-colors hover:bg-(--accent) hover:text-[#0b0a09]"
      >
        {t.backHome}
      </a>
    </section>
  );
}
