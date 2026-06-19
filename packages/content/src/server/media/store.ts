// The media library's record store — plain CRUD on the engine-owned
// `voila_media` table (emitted by `deriveSchema` when the config declares a
// media field). One row per upload: the storage `key` the bytes live under
// plus the metadata the serve route and admin UI need. Deliberately separate
// from `Database`: media records aren't documents (no soft-delete, drafts, or
// revisions), so they get a small dedicated store over the same `SqlDriver`.

import { MEDIA_TABLE } from "../../sql";
import type { SqlDriver, SqlRow, SqlValue } from "../database/driver";

export interface MediaRecord {
  readonly id: string;
  /** Storage object key the bytes live under (`<id>/<filename>`). */
  readonly key: string;
  readonly filename: string;
  readonly mime: string;
  /** Byte size of the upload. */
  readonly size: number;
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
  /** Epoch-ms upload time. */
  readonly createdAt: number;
}

export interface MediaListOpts {
  /** Page size. Clamped to 1–100; defaults to 20. */
  readonly limit?: number;
  /** Cursor returned as `nextCursor` from a prior page. */
  readonly cursor?: string;
}

export interface MediaListResult {
  /** Records ordered newest-first. */
  readonly records: ReadonlyArray<MediaRecord>;
  readonly nextCursor: string | null;
}

export interface MediaStore {
  /** Persist a new record (id minted by the caller — it's part of the storage
   *  `key` — `createdAt` stamped here); returns the stored row. */
  insert(record: Omit<MediaRecord, "createdAt">): Promise<MediaRecord>;
  /** Fetch one record, or `null` when the id is unknown. */
  get(id: string): Promise<MediaRecord | null>;
  /** Remove a record. Removing a missing id is a no-op. */
  delete(id: string): Promise<void>;
  /** Page through the library, newest upload first (keyset pagination). */
  list(opts?: MediaListOpts): Promise<MediaListResult>;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function mapRow(row: SqlRow): MediaRecord {
  return {
    id: String(row.id),
    key: String(row.key),
    filename: String(row.filename),
    mime: String(row.mime),
    size: Number(row.size),
    ...(row.width === null || row.width === undefined ? {} : { width: Number(row.width) }),
    ...(row.height === null || row.height === undefined ? {} : { height: Number(row.height) }),
    ...(row.alt === null || row.alt === undefined ? {} : { alt: String(row.alt) }),
    createdAt: Number(row.created_at),
  };
}

// The list cursor is the boundary row's `(createdAt, id)` — `id` breaks ties
// between same-millisecond uploads. Encoded as `<epochMs>:<id>`. Exported so the
// REST media route can pre-validate a `?cursor` and map a malformed one to a
// typed `400 INVALID_CURSOR` (like the collection read path) instead of letting
// `list` throw a raw `Error` that folds to a 500.
export function decodeListCursor(cursor: string): { createdAt: number; id: string } | null {
  const split = cursor.indexOf(":");
  if (split < 1) return null;
  const createdAt = Number(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (!Number.isFinite(createdAt) || id.length === 0) return null;
  return { createdAt, id };
}

export function makeMediaStore(driver: SqlDriver): MediaStore {
  return {
    async insert(record) {
      const createdAt = Date.now();
      await driver.run(
        `INSERT INTO "${MEDIA_TABLE}" ("id", "key", "filename", "mime", "size", "width", "height", "alt", "created_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.key,
          record.filename,
          record.mime,
          record.size,
          record.width ?? null,
          record.height ?? null,
          record.alt ?? null,
          createdAt,
        ],
      );
      return { ...record, createdAt };
    },

    async get(id) {
      const rows = await driver.all(`SELECT * FROM "${MEDIA_TABLE}" WHERE "id" = ?`, [id]);
      const row = rows[0];
      return row === undefined ? null : mapRow(row);
    },

    async delete(id) {
      await driver.run(`DELETE FROM "${MEDIA_TABLE}" WHERE "id" = ?`, [id]);
    },

    async list(opts) {
      const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const params: SqlValue[] = [];
      let where = "";
      if (opts?.cursor !== undefined) {
        const position = decodeListCursor(opts.cursor);
        if (position === null) throw new Error(`Malformed media cursor: "${opts.cursor}".`);
        where = `WHERE ("created_at" < ? OR ("created_at" = ? AND "id" < ?))`;
        params.push(position.createdAt, position.createdAt, position.id);
      }
      // Fetch one extra row to learn whether a next page exists.
      params.push(limit + 1);
      const rows = await driver.all(
        `SELECT * FROM "${MEDIA_TABLE}" ${where} ORDER BY "created_at" DESC, "id" DESC LIMIT ?`,
        params,
      );
      const page = rows.slice(0, limit).map(mapRow);
      const last = page[page.length - 1];
      const nextCursor = rows.length > limit && last ? `${last.createdAt}:${last.id}` : null;
      return { records: page, nextCursor };
    },
  };
}
