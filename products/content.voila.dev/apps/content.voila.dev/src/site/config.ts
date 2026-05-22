export const SITE = {
  name: "content.voila.dev",
  shortName: "voila",
  tagline: "The TanStack-native headless CMS",
  github: "https://github.com/voila-dev/content.voila.dev",
  docs: "https://content.voila.dev/docs",
  bootstrapCommand: "bunx create-voila@latest my-site",
  playgroundUrl: null as string | null,
} as const;

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#architecture", label: "Architecture" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#faq", label: "FAQ" },
] as const;
