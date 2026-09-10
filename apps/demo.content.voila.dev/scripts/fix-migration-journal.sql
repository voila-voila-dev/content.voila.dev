-- Realign the demo D1 with the repo's regenerated migration.
--
-- `voila migrate generate` emits a FULL schema snapshot, not a diff, so the
-- three old migrations were replaced by a single `0001_migration.sql`. The
-- journal still listed 0001-0003, so `d1 migrations apply` reported "No
-- migrations to apply" and the new schema never reached this database.
--
-- The content tables here are dead. Since the Durable Object sandbox landed,
-- every content request is served from the caller's own DO SQLite and D1 holds
-- auth only, so dropping them loses nothing. Dropping is also what lets the
-- snapshot's bare `CREATE TABLE` statements run at all — they carry no
-- `IF NOT EXISTS`, so a leftover table aborts the apply.
--
-- Dropped: every table the snapshot creates unguarded, so this is safe to
-- re-run and safe on a database that is already partly migrated.
-- NOT dropped: `user`, `session`, `account`, `verification`. The snapshot
-- creates those with `IF NOT EXISTS`, so real accounts survive untouched.
--
-- Take a backup first:
--   bunx wrangler d1 export demo-content-voila-dev --remote --output backup.sql
--
-- Then, from apps/demo.content.voila.dev — note `--command`, not `--file`,
-- because `--file` goes through D1's import API, which an OAuth login cannot
-- reach ("Authentication error [code: 10000]"):
--   bunx wrangler d1 execute demo-content-voila-dev --remote \
--     --command "$(cat scripts/fix-migration-journal.sql)"
--   bunx wrangler d1 migrations apply demo-content-voila-dev --remote

-- Collections that existed under the OLD config and are gone from the new one.
-- The snapshot cannot name these, so they have to be listed by hand or they
-- linger forever as orphans.
DROP TABLE IF EXISTS "posts";
DROP TABLE IF EXISTS "authors";
DROP TABLE IF EXISTS "events";

DROP TABLE IF EXISTS "films";
DROP TABLE IF EXISTS "screenings";
DROP TABLE IF EXISTS "people";
DROP TABLE IF EXISTS "journal";
DROP TABLE IF EXISTS "settings";
DROP TABLE IF EXISTS "voila_revisions";
DROP TABLE IF EXISTS "voila_media";
DROP TABLE IF EXISTS "voila_views";

-- Clear the journal so the regenerated migration applies and is recorded
-- under its real name.
DELETE FROM d1_migrations;
