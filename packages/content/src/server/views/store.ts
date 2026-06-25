// The saved-views store — owner-scoped CRUD over the engine-owned `voila_views`
// table (emitted by `deriveSchema` whenever the config has collections). One row
// per saved admin list view: the visible columns/order, sort, filters and
// view-shape choices a user pinned for a collection. Mirrors `media/store` —
// plain SQL over the same `SqlDriver`, deliberately separate from `Database`
// (views aren't documents). EVERY method scopes by `ownerId` in its `WHERE`, so
// one user can never read or mutate another's views; "one default per
// (owner, collection)" is enforced here in code (portable across SQLite/Postgres
// without a partial index).

import { VIEWS_TABLE } from "../../sql";
import type { SqlDriver, SqlRow } from "../database/driver";
import type { ListFilter } from "../database/types";

/** The shape a saved view renders as: a table, a kanban board, or a map. */
export type ViewType = "table" | "kanban" | "map";

/** A saved view's sort choice (the host maps `field` → the list `orderBy`). */
export interface ViewSort {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/**
 * The JSON payload a view stores: which columns show (and in what order), the
 * sort, the server-side filters, and the field choices the kanban/map shapes
 * need. All optional — an empty config is a plain default table view.
 */
export interface ViewConfig {
  /** Visible columns, in display order. Absent/empty → the table's defaults. */
  readonly columns?: ReadonlyArray<string>;
  readonly sort?: ViewSort;
  readonly filters?: ReadonlyArray<ListFilter>;
  /** The enum/select/status field a kanban view groups its columns by. */
  readonly kanbanField?: string;
  /** The geo field a map view plots markers from. */
  readonly geoField?: string;
}

export interface SavedView {
  readonly id: string;
  readonly collection: string;
  readonly ownerId: string;
  readonly name: string;
  readonly type: ViewType;
  readonly config: ViewConfig;
  /** The owner's default view for this collection (at most one — enforced here). */
  readonly isDefault: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fields a caller supplies to create a view (owner + collection come separately). */
export interface NewView {
  readonly name: string;
  readonly type: ViewType;
  readonly config: ViewConfig;
  readonly isDefault?: boolean;
}

/** A partial update to a view — only the supplied fields change. */
export interface ViewPatch {
  readonly name?: string;
  readonly type?: ViewType;
  readonly config?: ViewConfig;
  readonly isDefault?: boolean;
}

export interface ViewStore {
  /** The owner's views for a collection, oldest-first. */
  list(ownerId: string, collection: string): Promise<ReadonlyArray<SavedView>>;
  /** One of the owner's views by id, or `null` (unknown id, or another owner's). */
  get(ownerId: string, id: string): Promise<SavedView | null>;
  /** Persist a new view for the owner; returns the stored row. */
  create(ownerId: string, collection: string, view: NewView): Promise<SavedView>;
  /** Patch one of the owner's views in a collection; `null` if the id is unknown,
   *  not theirs, or belongs to a different collection (the route authorizes per
   *  collection, so the view's collection must match the URL's). */
  update(
    ownerId: string,
    collection: string,
    id: string,
    patch: ViewPatch,
  ): Promise<SavedView | null>;
  /** Delete one of the owner's views in a collection. A missing / other-owner /
   *  other-collection id is a no-op. */
  delete(ownerId: string, collection: string, id: string): Promise<void>;
}

function parseConfig(raw: unknown): ViewConfig {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ViewConfig;
    } catch {
      return {};
    }
  }
  // A driver that returns native JSON (a future Postgres path) hands back the object.
  return (raw as ViewConfig | null) ?? {};
}

function mapRow(row: SqlRow): SavedView {
  return {
    id: String(row.id),
    collection: String(row.collection),
    ownerId: String(row.owner_id),
    name: String(row.name),
    type: String(row.type) as ViewType,
    config: parseConfig(row.config),
    // SQLite/D1 store the boolean as 0/1; a native-boolean driver returns true.
    isDefault: row.is_default === 1 || row.is_default === true,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function makeViewStore(driver: SqlDriver): ViewStore {
  // Drop the default flag from the owner's other views in a collection, so the
  // one being set/created stays the sole default. Portable: a plain UPDATE, no
  // partial unique index.
  async function clearDefaults(
    ownerId: string,
    collection: string,
    exceptId: string,
  ): Promise<void> {
    await driver.run(
      `UPDATE "${VIEWS_TABLE}" SET "is_default" = 0
       WHERE "owner_id" = ? AND "collection" = ? AND "id" <> ?`,
      [ownerId, collection, exceptId],
    );
  }

  async function getOwned(ownerId: string, id: string): Promise<SavedView | null> {
    const rows = await driver.all(
      `SELECT * FROM "${VIEWS_TABLE}" WHERE "id" = ? AND "owner_id" = ?`,
      [id, ownerId],
    );
    const row = rows[0];
    return row === undefined ? null : mapRow(row);
  }

  return {
    async list(ownerId, collection) {
      const rows = await driver.all(
        `SELECT * FROM "${VIEWS_TABLE}" WHERE "owner_id" = ? AND "collection" = ?
         ORDER BY "created_at" ASC, "id" ASC`,
        [ownerId, collection],
      );
      return rows.map(mapRow);
    },

    get: getOwned,

    async create(ownerId, collection, view) {
      const id = crypto.randomUUID();
      const now = Date.now();
      const isDefault = view.isDefault === true;
      if (isDefault) await clearDefaults(ownerId, collection, id);
      await driver.run(
        `INSERT INTO "${VIEWS_TABLE}"
           ("id", "collection", "owner_id", "name", "type", "config", "is_default", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          collection,
          ownerId,
          view.name,
          view.type,
          JSON.stringify(view.config ?? {}),
          isDefault ? 1 : 0,
          now,
          now,
        ],
      );
      return {
        id,
        collection,
        ownerId,
        name: view.name,
        type: view.type,
        config: view.config ?? {},
        isDefault,
        createdAt: now,
        updatedAt: now,
      };
    },

    async update(ownerId, collection, id, patch) {
      const existing = await getOwned(ownerId, id);
      // The view must belong to the owner AND the URL's collection — the route
      // only authorized `update` against that collection.
      if (existing === null || existing.collection !== collection) return null;
      const next: SavedView = {
        ...existing,
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.type === undefined ? {} : { type: patch.type }),
        ...(patch.config === undefined ? {} : { config: patch.config }),
        ...(patch.isDefault === undefined ? {} : { isDefault: patch.isDefault }),
        updatedAt: Date.now(),
      };
      if (patch.isDefault === true) await clearDefaults(ownerId, existing.collection, id);
      await driver.run(
        `UPDATE "${VIEWS_TABLE}"
           SET "name" = ?, "type" = ?, "config" = ?, "is_default" = ?, "updated_at" = ?
         WHERE "id" = ? AND "owner_id" = ?`,
        [
          next.name,
          next.type,
          JSON.stringify(next.config ?? {}),
          next.isDefault ? 1 : 0,
          next.updatedAt,
          id,
          ownerId,
        ],
      );
      return next;
    },

    async delete(ownerId, collection, id) {
      await driver.run(
        `DELETE FROM "${VIEWS_TABLE}" WHERE "id" = ? AND "owner_id" = ? AND "collection" = ?`,
        [id, ownerId, collection],
      );
    },
  };
}
