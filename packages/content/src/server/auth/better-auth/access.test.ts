// first-user-wins access policy, exercised against a real in-memory connection
// holding the Better Auth `user` table.

import { beforeEach, describe, expect, it } from "bun:test";
import { authTableStatements } from "../../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../../database/bun-sqlite-driver";
import type { AccessRequest } from "../access";
import { firstUserAccess } from "./access";

let driver: SqliteDriver;

// Insert a user row with an explicit creation time so ordering is deterministic.
async function addUser(id: string, email: string, createdAt: number): Promise<void> {
  await driver.run(
    'INSERT INTO "user" ("id", "email", "emailVerified", "createdAt", "updatedAt") VALUES (?, ?, 1, ?, ?)',
    [id, email, createdAt, createdAt],
  );
}

// A minimal authorized request for `principalId` — the policy only reads `principal.id`.
function request(principalId: string): AccessRequest {
  return { principal: { id: principalId }, operation: "list", collection: "posts" };
}

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of authTableStatements) await driver.run(statement);
});

describe("firstUserAccess", () => {
  it("admits the earliest-created user", async () => {
    await addUser("u1", "owner@x.dev", 1000);
    await addUser("u2", "later@x.dev", 2000);
    const access = firstUserAccess(driver);
    expect(await access(request("u1"))).toBe(true);
  });

  it("denies any later user", async () => {
    await addUser("u1", "owner@x.dev", 1000);
    await addUser("u2", "later@x.dev", 2000);
    const access = firstUserAccess(driver);
    expect(await access(request("u2"))).toBe(false);
  });

  it("denies when no user exists yet", async () => {
    const access = firstUserAccess(driver);
    expect(await access(request("nobody"))).toBe(false);
  });

  it("memoizes the first user — a row inserted earlier later does not steal ownership", async () => {
    await addUser("u1", "owner@x.dev", 1000);
    const access = firstUserAccess(driver);
    expect(await access(request("u1"))).toBe(true);

    // A backdated row appears after the first resolution; the cached owner wins.
    await addUser("u0", "sneaky@x.dev", 500);
    expect(await access(request("u0"))).toBe(false);
    expect(await access(request("u1"))).toBe(true);
  });
});
