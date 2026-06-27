-- ViewStore (tab drag-reorder) reads/writes voila_views.position, but 0002 created
-- the table without it — so every `_views` call 500s on the live demo. Add the
-- column to match `viewsTable()` in deriveSchema (INTEGER NOT NULL DEFAULT 0).
ALTER TABLE "voila_views" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
