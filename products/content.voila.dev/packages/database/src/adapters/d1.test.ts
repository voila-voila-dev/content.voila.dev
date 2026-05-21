import { describe, expect, test } from "bun:test";
import type { AnyD1Database } from "drizzle-orm/d1";
import { d1 } from "./d1.ts";

// Real D1 query execution is exercised by the playground's integration tests
// against `wrangler dev` (see roadmap M1). The unit tests here verify the
// adapter shape and that the binding is wired straight through to drizzle.

function fakeBinding(): AnyD1Database {
  // biome-ignore lint/suspicious/noExplicitAny: stub binding — drizzle stores it on `.$client` and never calls into it until a query is actually issued.
  return { __brand: "fake-d1" } as any;
}

describe("d1()", () => {
  test("returns an adapter tagged sqlite + d1", () => {
    const adapter = d1({ binding: fakeBinding() });
    expect(adapter.dialect).toBe("sqlite");
    expect(adapter.driver).toBe("d1");
  });

  test("has no close() — D1 is connectionless", () => {
    const adapter = d1({ binding: fakeBinding() });
    expect(adapter.close).toBeUndefined();
  });

  test("passes the binding straight through to drizzle", () => {
    const binding = fakeBinding();
    const adapter = d1({ binding });
    // drizzle-orm/d1 exposes the original client on `.$client`; the public
    // `DrizzleD1Database` type doesn't surface it, so cast to read it back.
    const drizzleWithClient = adapter.drizzle as unknown as { $client: AnyD1Database };
    expect(drizzleWithClient.$client).toBe(binding);
  });
});
