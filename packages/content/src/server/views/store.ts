// The saved-views store — GLOBAL (shared) CRUD over the engine-owned
// `voila_views` table (emitted by `deriveSchema` whenever the config has
// collections). One row per saved admin list view: the visible columns/order,
// sort, filters and view-shape choices. Mirrors `media/store` — plain SQL over
// the same `SqlDriver`, deliberately separate from `Database` (views aren't
// documents).
//
// Views are SHARED across all admin users: queries scope by `collection` only,
// never by user, so everyone sees and can edit the same set (the `owner_id`
// column is retained purely as the creator id, for audit). Each collection has
// one undeletable, auto-seeded default Table view (a reserved id) so a table is
// always available; "one default per collection" (which view loads first) is
// enforced here in code, portable across SQLite/Postgres without a partial index.

import { VIEWS_TABLE } from "../../sql";
import type { SqlDriver, SqlRow } from "../database/driver";
import type { ListFilter } from "../database/types";

/** The shape a saved view renders as: a table, a kanban board, a map, or a calendar. */
export type ViewType = "table" | "kanban" | "map" | "calendar";

/** A saved view's sort choice (the host maps `field` → the list `orderBy`). */
export interface ViewSort {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/**
 * The JSON payload a view stores: which columns show (and in what order), the
 * sort, the server-side filters, and the field choices the kanban/map/calendar
 * shapes need. All optional — an empty config is a plain default table view.
 */
export interface ViewConfig {
  /** Visible columns, in display order. Absent/empty → the table's defaults. */
  readonly columns?: ReadonlyArray<string>;
  /** Fields shown on a board/map/calendar card. Absent → the view's defaults. */
  readonly cardFields?: ReadonlyArray<string>;
  readonly sort?: ViewSort;
  readonly filters?: ReadonlyArray<ListFilter>;
  /** The enum/select/status field a kanban view groups its columns by. */
  readonly kanbanField?: string;
  /** The geo field a map view plots markers from. */
  readonly geoField?: string;
  /** The date/datetime field a calendar view starts its events on. */
  readonly calendarField?: string;
  /** Optional date/datetime field a calendar event ends on (range events). */
  readonly calendarEndField?: string;
  /** The calendar's granularity. */
  readonly calendarView?: "month" | "week" | "day";
}

export interface SavedView {
  readonly id: string;
  readonly collection: string;
  /** The id of the user who created the view (audit only — views are shared). */
  readonly ownerId: string;
  readonly name: string;
  readonly type: ViewType;
  readonly config: ViewConfig;
  /** The collection's default view (loads first; at most one — enforced here). */
  readonly isDefault: boolean;
  /** The auto-seeded, undeletable default Table view for the collection. */
  readonly seeded: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fields a caller supplies to create a view (collection + creator come separately). */
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
  /** Every view for a collection, oldest-first (shared across all users). */
  list(collection: string): Promise<ReadonlyArray<SavedView>>;
  /** A view by id, or `null` for an unknown id. */
  get(id: string): Promise<SavedView | null>;
  /** Persist a new view; `createdBy` is recorded as the creator. */
  create(collection: string, view: NewView, createdBy: string): Promise<SavedView>;
  /** Patch a view in a collection; `null` if the id is unknown or belongs to a
   *  different collection (the route authorizes per collection). The seeded
   *  default keeps its `table` type (a `type` patch on it is ignored). */
  update(collection: string, id: string, patch: ViewPatch): Promise<SavedView | null>;
  /** Delete a view in a collection. The seeded default is undeletable (no-op);
   *  a missing / other-collection id is a no-op too. */
  delete(collection: string, id: string): Promise<void>;
  /** Idempotently ensure the collection has its undeletable default Table view,
   *  returning it. Safe to call on every list (PK conflict → ignored). */
  ensureDefault(collection: string, createdBy: string): Promise<SavedView>;
}

/** The reserved, deterministic id of a collection's seeded default Table view. */
export function defaultViewId(collection: string): string {
  return `default-${collection}`;
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
  const id = String(row.id);
  const collection = String(row.collection);
  return {
    id,
    collection,
    ownerId: String(row.owner_id),
    name: String(row.name),
    type: String(row.type) as ViewType,
    config: parseConfig(row.config),
    // SQLite/D1 store the boolean as 0/1; a native-boolean driver returns true.
    isDefault: row.is_default === 1 || row.is_default === true,
    seeded: id === defaultViewId(collection),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function makeViewStore(driver: SqlDriver): ViewStore {
  // Drop the default flag from a collection's other views, so the one being
  // set/created stays the sole default. Portable: a plain UPDATE, no partial index.
  async function clearDefaults(collection: string, exceptId: string): Promise<void> {
    await driver.run(
      `UPDATE "${VIEWS_TABLE}" SET "is_default" = 0
       WHERE "collection" = ? AND "id" <> ?`,
      [collection, exceptId],
    );
  }

  async function getById(id: string): Promise<SavedView | null> {
    const rows = await driver.all(`SELECT * FROM "${VIEWS_TABLE}" WHERE "id" = ?`, [id]);
    const row = rows[0];
    return row === undefined ? null : mapRow(row);
  }

  const store: ViewStore = {
    async list(collection) {
      const rows = await driver.all(
        `SELECT * FROM "${VIEWS_TABLE}" WHERE "collection" = ?
         ORDER BY "created_at" ASC, "id" ASC`,
        [collection],
      );
      return rows.map(mapRow);
    },

    get: getById,

    async create(collection, view, createdBy) {
      const id = crypto.randomUUID();
      const now = Date.now();
      const isDefault = view.isDefault === true;
      if (isDefault) await clearDefaults(collection, id);
      await driver.run(
        `INSERT INTO "${VIEWS_TABLE}"
           ("id", "collection", "owner_id", "name", "type", "config", "is_default", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          collection,
          createdBy,
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
        ownerId: createdBy,
        name: view.name,
        type: view.type,
        config: view.config ?? {},
        isDefault,
        seeded: false,
        createdAt: now,
        updatedAt: now,
      };
    },

    async update(collection, id, patch) {
      const existing = await getById(id);
      // The view must belong to the URL's collection — the route only authorized
      // `update` against that collection.
      if (existing === null || existing.collection !== collection) return null;
      // The seeded default stays a table (so a table view always exists).
      const type = existing.seeded ? "table" : (patch.type ?? existing.type);
      const next: SavedView = {
        ...existing,
        ...(patch.name === undefined ? {} : { name: patch.name }),
        type,
        ...(patch.config === undefined ? {} : { config: patch.config }),
        ...(patch.isDefault === undefined ? {} : { isDefault: patch.isDefault }),
        updatedAt: Date.now(),
      };
      if (patch.isDefault === true) await clearDefaults(collection, id);
      await driver.run(
        `UPDATE "${VIEWS_TABLE}"
           SET "name" = ?, "type" = ?, "config" = ?, "is_default" = ?, "updated_at" = ?
         WHERE "id" = ? AND "collection" = ?`,
        [
          next.name,
          next.type,
          JSON.stringify(next.config ?? {}),
          next.isDefault ? 1 : 0,
          next.updatedAt,
          id,
          collection,
        ],
      );
      return next;
    },

    async delete(collection, id) {
      // The seeded default is undeletable — keep a table view always present.
      if (id === defaultViewId(collection)) return;
      await driver.run(`DELETE FROM "${VIEWS_TABLE}" WHERE "id" = ? AND "collection" = ?`, [
        id,
        collection,
      ]);
    },

    async ensureDefault(collection, createdBy) {
      const id = defaultViewId(collection);
      const existing = await getById(id);
      if (existing !== null) return existing;
      const now = Date.now();
      // Portable check-then-insert. A concurrent first-load may race us to the
      // INSERT and hit the primary-key conflict — swallow it and re-read, so the
      // loser still returns the seeded row rather than erroring.
      try {
        await driver.run(
          `INSERT INTO "${VIEWS_TABLE}"
             ("id", "collection", "owner_id", "name", "type", "config", "is_default", "created_at", "updated_at")
           VALUES (?, ?, ?, ?, 'table', '{}', 1, ?, ?)`,
          [id, collection, createdBy, "Table", now, now],
        );
      } catch {
        // Lost the race — the row now exists; fall through to the re-read.
      }
      const seeded = await getById(id);
      return (
        seeded ?? {
          id,
          collection,
          ownerId: createdBy,
          name: "Table",
          type: "table",
          config: {},
          isDefault: true,
          seeded: true,
          createdAt: now,
          updatedAt: now,
        }
      );
    },
  };

  return store;
}
