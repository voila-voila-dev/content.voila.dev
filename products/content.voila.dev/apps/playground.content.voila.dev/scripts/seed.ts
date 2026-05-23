/**
 * Seed sample data into the local D1 database so the admin views have
 * something to render in dev. Idempotent — uses INSERT OR IGNORE so reruns
 * don't error on the unique `slug` index. Run via `bun run db:seed`.
 */

import { execSync } from "node:child_process";

const NOW = Date.now();

const POSTS = [
  {
    id: "01jx0000000000000000000001",
    title: "Hello world",
    slug: "hello-world",
    excerpt: "A first post excerpt.",
    body: "# Hello world\n\nWelcome to the Voila playground.",
    published: 1,
    publishedAt: NOW,
  },
  {
    id: "01jx0000000000000000000002",
    title: "Markdown demo",
    slug: "markdown-demo",
    excerpt: "Showcasing the read path with a second seeded post.",
    body: "Body content goes here.",
    published: 1,
    publishedAt: NOW - 86_400_000,
  },
  {
    id: "01jx0000000000000000000003",
    title: "Draft idea",
    slug: "draft-idea",
    excerpt: null,
    body: "Still thinking about this one.",
    published: 0,
    publishedAt: null,
  },
];

const CONFIG = {
  id: "config",
  siteName: "Voila Playground",
  description: "A playground for the Voila CMS.",
  domain: "playground.voila.dev",
  defaultLocale: "en",
};

function sqlValue(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

const postsSql = POSTS.map(
  (p) =>
    `INSERT OR IGNORE INTO posts (id, title, slug, excerpt, body, published, published_at, created_at, updated_at) VALUES (${sqlValue(p.id)}, ${sqlValue(p.title)}, ${sqlValue(p.slug)}, ${sqlValue(p.excerpt)}, ${sqlValue(p.body)}, ${p.published}, ${sqlValue(p.publishedAt)}, ${NOW}, ${NOW});`,
).join(" ");

const configSql = `INSERT OR IGNORE INTO config (id, site_name, description, domain, default_locale, created_at, updated_at) VALUES (${sqlValue(CONFIG.id)}, ${sqlValue(CONFIG.siteName)}, ${sqlValue(CONFIG.description)}, ${sqlValue(CONFIG.domain)}, ${sqlValue(CONFIG.defaultLocale)}, ${NOW}, ${NOW});`;

const command = `${postsSql} ${configSql}`;

console.log(`[seed] inserting ${POSTS.length} posts + 1 config row…`);
execSync(`bunx wrangler d1 execute DATABASE --local --command "${command}"`, {
  stdio: "inherit",
});
console.log("[seed] done");
