-- Initial D1 schema for the Voila playground.
-- M0 ships an empty schema; M1 will land the schema-to-table generator
-- in `packages/database` and replace this file with generated DDL.

CREATE TABLE IF NOT EXISTS _voila_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO _voila_meta (key, value) VALUES ('schema_version', '0');
