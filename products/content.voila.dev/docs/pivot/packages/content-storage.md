# @voila/content-storage

> Storage `Service` for binary assets: upload, retrieve, delete, presigned URLs, and image transforms — with R2 and S3 `Layer`s. **World:** Engine. **Layer:** L3. **Status:** M3 (R2) → M4 (S3, transforms).

## Responsibility

**Owns:**
- The `Storage` `Service` — the interface resolvers and HTTP handlers call for asset operations.
- Presigned URL generation (upload and download) so the browser can PUT directly to the bucket without routing bytes through the worker.
- Image transform metadata (width/height/format hints) stored alongside asset records.
- `R2Live` and `S3Live` `Layer`s that satisfy `Storage`.

**Does not own:**
- Asset metadata persistence (stored as documents via `Database` / `@voila/content-sql`).
- Auth on presigned URLs — delegated to the storage provider's own signing key.
- HTTP route mounting — `@voila/content/server` wires the upload/asset endpoints.

## Public API

### Service

| Export | Kind | Description |
|--------|------|-------------|
| `Storage` | `Context.Tag<Storage>` | The service tag; resolvers and HTTP handlers depend on this |
| `StorageLive` | `Layer<Storage, never, StorageBackend>` | Thin orchestration layer over the backend |
| `R2Live` | `(opts: R2LiveOpts) => Layer<StorageBackend>` | Cloudflare R2 backend |
| `S3Live` | `(opts: S3LiveOpts) => Layer<StorageBackend>` | AWS S3 / S3-compatible backend |

### `Storage` service interface (conceptual)

```ts
interface Storage {
  readonly presignUpload: (opts: PresignUploadOpts) => Effect<PresignedUpload, StorageError>
  readonly presignDownload: (key: string, opts?: PresignDownloadOpts) => Effect<string, StorageError>
  readonly delete: (key: string) => Effect<void, StorageError>
  readonly metadata: (key: string) => Effect<AssetMetadata | null, StorageError>
}

interface PresignedUpload {
  uploadUrl:  string   // PUT here from the browser
  publicUrl:  string   // the permanent asset URL
  key:        string   // opaque storage key
  expiresAt:  Date
}
```

### Config shapes

```ts
interface R2LiveOpts {
  binding: R2Bucket         // from cloudflare:workers env
  publicDomain?: string     // e.g. "media.acme.com" for public bucket URLs
}

interface S3LiveOpts {
  bucket:          string
  region:          string
  endpoint?:       string   // for S3-compatible stores (Tigris, Backblaze, etc.)
  credentials:     AwsCredentials
  publicDomain?:   string
}
```

## Effect surface

| Primitive | Use |
|-----------|-----|
| `@effect/platform` `HttpClient` | S3 presign request signing (AWS Signature V4) |
| `Context.Tag` | `Storage`, `StorageBackend` service identities |
| `Layer` | `StorageLive`, `R2Live`, `S3Live` |
| `Effect.gen` | Service implementations |
| `Schema` (effect/Schema) | `AssetMetadata` codec; `PresignedUpload` response shape |
| `Data.TaggedError` | `StorageError` typed error |

The R2 adapter calls the Workers `R2Bucket` binding directly (no HTTP). The S3 adapter uses `@effect/platform`'s `HttpClient` to sign and execute presign requests, keeping it environment-agnostic (works in Node/Bun/Cloudflare).

## Dependencies

```json
{
  "dependencies": {
    "effect":              "^3.x",
    "@effect/platform":    "^0.x"
  },
  "peerDependencies": {
    "@cloudflare/workers-types": "optional",
    "@aws-sdk/client-s3":        "optional"
  }
}
```

Backends are optional peers — a consumer who only uses R2 never installs the S3 SDK.

## Usage

### Wire R2 in `content.config.ts`

```ts
import { defineContent } from "@voila/content"
import { R2Live } from "@voila/content-storage"

export default defineContent({
  collections: [posts, media],
  storage: R2Live({ binding: env.MEDIA, publicDomain: "media.acme.com" }),
})
```

### Wire S3 (or S3-compatible)

```ts
import { S3Live } from "@voila/content-storage"

const storage = S3Live({
  bucket:      "acme-media",
  region:      "auto",
  endpoint:    "https://fly.storage.tigris.dev",  // Tigris / Backblaze / Minio
  credentials: { accessKeyId: "…", secretAccessKey: "…" },
})
```

### Call `Storage` from a resolver

```ts
import { Storage } from "@voila/content-storage"
import { Effect } from "effect"

const requestUpload = (filename: string, mimeType: string) =>
  Effect.gen(function* () {
    const storage = yield* Storage
    return yield* storage.presignUpload({ filename, mimeType, maxBytes: 10_000_000 })
  })
// returns { uploadUrl, publicUrl, key, expiresAt }
// browser PUTs directly to uploadUrl; publicUrl is stored in the document
```

### Image transform hints

Transform metadata (resize, format conversion) is stored as annotations on the asset record; the actual transformation is performed by a Cloudflare Image Resizing URL rewrite or a worker-side sharp pipeline, not inside `@voila/content-storage` itself. The `Storage` service stores the intent; execution is infrastructure-level.

## Extension points (A′)

Provide a different `Layer<StorageBackend>` to swap the storage provider — `StorageLive` is unchanged:

```ts
// Hypothetical Vercel Blob backend — community adapter (not under @voila/ scope)
import { BlobLive } from "acme-voila-storage-blob"

const storage = BlobLive({ token: process.env.BLOB_TOKEN! })
```

Any backend that satisfies the `StorageBackend` Tag (presignUpload, presignDownload, delete, metadata) drops in without changes to `@voila/content/server` or the resolvers.

## Replaces

No direct predecessor in the current `@voila/content-database` tree — storage was not yet implemented. The design supersedes the informal upload pattern sketched in the M2 write path (direct `fetch` to R2 without a service layer). Drizzle asset tables become `@voila/content-sql` collections; the storage adapter becomes this `Service`/`Layer` pair.

## Testing

- **Unit — presign logic:** mock the `StorageBackend` Tag with a test double that returns a fixed URL; assert `Storage.presignUpload` constructs the expected metadata.
- **Unit — S3 signing:** assert AWS Signature V4 headers are present on the outgoing HTTP request using a captured `HttpClient` test layer.
- **Integration — R2:** Miniflare's R2 simulation in the playground canary; exercises the full presign→PUT→retrieve round-trip.
- **Integration — S3-compatible:** optional CI job against a local Minio container.
- All tests via `bun test`; no live cloud credentials required for unit and Miniflare paths.

---

Continue → [content-sql.md](./content-sql.md) · [effect-architecture-canon.md](../effect-architecture-canon.md)
