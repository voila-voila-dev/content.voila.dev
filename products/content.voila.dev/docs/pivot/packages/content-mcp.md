# @voila/content-mcp

> MCP (Model Context Protocol) server over the `voilaApi` `HttpApi` definition and content schema; supports HTTP and stdio transports. **World:** Engine. **Layer:** —. **Status:** M6 target.

## Responsibility

Owns: the MCP server `Service`; tool definitions derived from the `voilaApi` endpoints and collection schemas; HTTP and stdio transport `Layer`s; the OpenAPI spec bridge (feeds tool descriptions from `OpenApi.fromApi`).

Does not own: the `HttpApi` definition (`@voila/content/server`), the content resolvers (`@voila/content`), or the `voila mcp` CLI command that launches this server (`@voila/content-cli`).

## Public API

```ts
// The MCP Service tag
export declare class McpServer extends Context.Tag("@voila/content-mcp/McpServer")<
  McpServer,
  { start(): Effect.Effect<void, McpError> }
>() {}

// HTTP transport Layer — exposes MCP over SSE at the given path
export declare const HttpTransportLive: (opts: {
  path?: string    // default "/admin/mcp"
}) => Layer.Layer<McpServer, never, HttpApiRouter>

// Stdio transport Layer — for IDE integrations (cursor, claude desktop, etc.)
export declare const StdioTransportLive: Layer.Layer<McpServer>

// Build the full Layer for a content config (auto-derives tools from voilaApi + schemas)
export declare const makeMcpLayer: (config: ContentConfig) => Layer.Layer<McpServer>

export declare class McpError extends Data.TaggedError("McpError")<{ cause: unknown }> {}
```

**Derived MCP tools (auto-generated from `voilaApi`):**

Each `HttpApiGroup` (i.e. each collection) produces a set of tools:
- `<collection>_list` — list documents with pagination
- `<collection>_find` — find by id
- `<collection>_findOne` — find by unique field
- `<collection>_create` — create a document
- `<collection>_update` — update a document (PATCH)
- `<collection>_delete` — soft-delete
- `<collection>_restore` — restore

Tool input schemas are derived from the same `effect/Schema` request schemas used in `voilaApi`; descriptions come from `OpenApi.fromApi` annotations.

## Effect surface

- `@effect/platform`: `HttpApi`, `HttpRouter`, `OpenApi.fromApi` — tools are derived from the same `HttpApi` definition as the REST surface; no separate schema authoring.
- `@effect/ai` — if/when the Effect AI package provides first-class MCP primitives, this package uses them; otherwise the MCP wire protocol is implemented directly over `@effect/platform`'s `HttpServer` (SSE) and `NodeStream` (stdio).
- `Effect`, `Layer`, `Context`, `Stream` — stdio transport uses `Stream` for the message loop.

## Dependencies

```
@voila/content/server    # voilaApi + makeHandlerLayer (to execute tools via the engine)
@voila/content-schema          # collection schemas for tool input validation
@voila/content-auth            # Auth Service (tools require a session; MCP auth via header/token)
@effect/platform
effect
(@effect/ai)           # optional, used if it provides MCP primitives
```

## Usage

Via the `voila` CLI (most common — launched by the IDE integration):

```bash
voila mcp --stdio        # stdio transport for Cursor / Claude Desktop
voila mcp --http         # SSE transport, mounted at /admin/mcp
```

Embedded in the content runtime (HTTP transport, same worker):

```ts
import { defineContent } from "@voila/content"
import { HttpTransportLive } from "@voila/content-mcp"

export default defineContent({
  // ...
  mcp: HttpTransportLive({ path: "/admin/mcp" }),
})
```

Direct tool use from an AI agent:

```
// MCP client discovers tools:
{ name: "posts_list",   description: "List published posts", inputSchema: { limit?, cursor?, orderBy? } }
{ name: "posts_create", description: "Create a post",        inputSchema: { title: string, body: string, ... } }

// Agent calls:
posts_create({ title: "AI-authored post", body: "…" })
```

## Extension points (A′)

- Add custom MCP tools by providing additional `HttpApiGroup`s via `HttpApi.add(voilaApi, myGroup)` in `@voila/content/server` — they are automatically picked up by `makeMcpLayer`.
- Swap the transport `Layer` (HTTP ↔ stdio) without touching tool definitions.
- Provide a custom `Auth` `Layer` for MCP-specific authentication (e.g. API-key header instead of session cookie).

## Replaces

There is no current MCP implementation — this is new work and a M6 greenfield deliverable. The `voila mcp` CLI subcommand currently does not exist.
