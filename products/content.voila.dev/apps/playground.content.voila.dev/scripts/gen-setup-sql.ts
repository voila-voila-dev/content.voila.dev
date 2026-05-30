// Emits the local-D1 setup SQL (collection DDL + Better Auth tables + a seed
// post) to stdout. Pipe into `wrangler d1 execute DATABASE --local --file=…`.
import { authTablesSql } from "@voila/content/auth";
import { deriveSchema, generateDDL } from "@voila/content/sql";
import config from "../src/content.config";

// Idempotent: drop the collection table first so re-runs (E2E) start clean. The
// auth tables already use `CREATE TABLE IF NOT EXISTS`.
const reset = `DROP TABLE IF EXISTS posts;`;
const ddl = generateDDL(deriveSchema(config), "sqlite");
const seed = `INSERT INTO posts (id, title, published) VALUES ('post_seed_1', 'Hello world', 1);`;

process.stdout.write([reset, ddl, authTablesSql, seed].join("\n\n") + "\n");
