import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const CONFIG_CODE = `// content.config.ts
import { defineContent, defineCollection, fields } from "@voila/content";
import { r2 } from "@voila/storage";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  icon: "NewspaperClipping",
  fields: {
    title: fields.string({ required: true, max: 120 }),
    slug:  fields.slug({ from: "title" }),
    body:  fields.richText(),
    cover: fields.media({ accept: ["image/*"] }),
    tags:  fields.array(fields.string()),
    publishedAt: fields.datetime(),
  },
  list: { columns: ["title", "publishedAt", "tags"] },
});

export default defineContent({
  branding: { name: "My Site", logo: "/logo.svg" },
  collections: [posts],
  storage: r2({ bucket: "media" }),
});`;

const ROUTE_CODE = `// app/routes/admin/$.ts
import { createServerFileRoute } from "@tanstack/react-start/server";
import { content } from "~/content.config";

export const ServerRoute = createServerFileRoute("/admin/$").methods({
  GET:    ({ request }) => content.handle(request),
  POST:   ({ request }) => content.handle(request),
  PUT:    ({ request }) => content.handle(request),
  PATCH:  ({ request }) => content.handle(request),
  DELETE: ({ request }) => content.handle(request),
});`;

const USAGE_CODE = `// app/routes/blog/$slug.tsx — fully typed from your schema
import { createFileRoute } from "@tanstack/react-router";
import { client } from "~/content.client";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => client.posts.findOne({ slug: params.slug }),
  component: ({ loaderData: post }) => (
    <article>
      <h1>{post.title}</h1>
      <img src={post.cover.url} alt="" />
      <div dangerouslySetInnerHTML={{ __html: post.body.html }} />
    </article>
  ),
});`;

export function ArchitectureSection() {
  return (
    <Section id="architecture">
      <SectionEyebrow>Architecture</SectionEyebrow>
      <SectionHeading>One config. One route. Three handlers.</SectionHeading>
      <SectionLead>
        The whole CMS — admin SPA, REST API, MCP server — is dispatched from a single TanStack Start
        catch-all. No second server. No second deploy.
      </SectionLead>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CodeBlock title="content.config.ts" caption="Define your content" code={CONFIG_CODE} />
        <CodeBlock title="app/routes/admin/$.ts" caption="Mount the handler" code={ROUTE_CODE} />
        <CodeBlock
          title="app/routes/blog/$slug.tsx"
          caption="Use the typed client"
          code={USAGE_CODE}
        />
      </div>
    </Section>
  );
}

function CodeBlock({ title, caption, code }: { title: string; caption: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">{title}</span>
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </span>
      </div>
      <pre className="max-h-[26rem] overflow-auto p-4 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
