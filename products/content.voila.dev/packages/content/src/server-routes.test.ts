import { describe, expect, test } from "bun:test";
import { healthGET } from "./server-routes.ts";

describe("healthGET", () => {
  test("returns a JSON response with an ok body", async () => {
    const response = await healthGET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.name).toBe("@voila/content");
    expect(typeof body.version).toBe("string");
    expect(typeof body.time).toBe("string");
    expect(new Date(body.time as string).toString()).not.toBe("Invalid Date");
  });

  test("ignores the optional context argument", async () => {
    const response = await healthGET({ request: new Request("http://localhost/anything") });
    expect(response.status).toBe(200);
  });
});
