// Public surface of the storage layer: the `Storage` seam and the shipped
// adapters. Memory for tests/throwaway dev, fs for local dev (Node/Bun only),
// R2 for Workers bindings, S3 for anything speaking the S3 API (AWS, R2's S3
// endpoint, MinIO).

export { type FsStorageOpts, makeFsStorage } from "./fs";
export { makeMemoryStorage } from "./memory";
export { makeR2Storage, type R2BucketLike } from "./r2";
export { makeS3Storage, type S3StorageOpts } from "./s3";
export type { SignedUrlOpts, Storage, StorageObject, StoragePutOpts } from "./types";
