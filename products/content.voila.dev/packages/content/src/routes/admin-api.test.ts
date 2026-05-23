import { describe, expect, test } from "bun:test";
import {
  adminApiByFieldSource,
  adminApiByIdSource,
  adminApiListSource,
  cloudflareEnvDeclSource,
} from "./admin-api.ts";

describe("admin API route sources", () => {
  test("each route declares the matching createFileRoute id + handler", () => {
    const cases = [
      {
        src: adminApiListSource("../../../content.config"),
        id: "/admin/api/$collection",
        handler: "handleList",
      },
      {
        src: adminApiByIdSource("../../../content.config"),
        id: "/admin/api/$collection/$id",
        handler: "handleFindById",
      },
      {
        src: adminApiByFieldSource("../../../content.config"),
        id: "/admin/api/$collection/by/$field/$value",
        handler: "handleFindByField",
      },
    ];
    for (const { src, id, handler } of cases) {
      expect(src).toContain(`createFileRoute("${id}")`);
      expect(src).toContain(`import { ${handler} } from "@voila/content/server"`);
      expect(src).toContain('import { env } from "cloudflare:workers"');
      expect(src).toContain("d1FromBinding(env.DATABASE)");
      expect(src).toContain('import content from "../../../content.config"');
      // GET-only for the read milestone.
      expect(src).toContain("GET:");
      expect(src).not.toContain("POST:");
    }
  });

  test("emits an ambient cloudflare:workers env declaration", () => {
    const decl = cloudflareEnvDeclSource();
    expect(decl).toContain('declare module "cloudflare:workers"');
    expect(decl).toContain("export const env");
  });
});
