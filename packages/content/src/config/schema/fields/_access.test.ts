// `accessibleFields` and the per-field predicate helpers: the client-safe
// evaluation of `field.meta.access` an admin UI uses to decide which fields to
// render. The REST layer's enforcement (redaction, write denial) is covered in
// server/rest/field-access.test.ts; this suite pins the pure partitioning.

import { describe, expect, it } from "bun:test";
import { accessibleFields, canReadField, canWriteField } from "./_access";
import type { FieldAccessContext } from "./_annotation";
import { string } from "./string";

const admin: FieldAccessContext = {
  principal: { id: "u1", roles: ["admin"] },
  operation: "read",
  collection: "posts",
};

const viewer: FieldAccessContext = {
  principal: { id: "u2", roles: ["viewer"] },
  operation: "read",
  collection: "posts",
};

const anonymous: FieldAccessContext = {
  principal: null,
  operation: "read",
  collection: "posts",
};

const isAdmin = (ctx: FieldAccessContext): boolean =>
  ctx.principal?.roles?.includes("admin") ?? false;

const fields = {
  title: string({ required: true }),
  internalNotes: string({ access: { read: isAdmin } }),
  status: string({ access: { write: isAdmin } }),
};

describe("accessibleFields", () => {
  it("keeps every field for a principal the predicates allow", () => {
    expect(accessibleFields(fields, admin)).toEqual({
      readable: ["title", "internalNotes", "status"],
      writable: ["title", "internalNotes", "status"],
    });
  });

  it("partitions read- and write-denied fields independently", () => {
    expect(accessibleFields(fields, viewer)).toEqual({
      readable: ["title", "status"],
      writable: ["title", "internalNotes"],
    });
  });

  it("treats an unauthenticated caller as a principal of null", () => {
    const result = accessibleFields(fields, anonymous);
    expect(result.readable).toEqual(["title", "status"]);
    expect(result.writable).toEqual(["title", "internalNotes"]);
  });
});

describe("canReadField / canWriteField", () => {
  it("allows when no access rules exist", () => {
    expect(canReadField(fields.title, viewer)).toBe(true);
    expect(canWriteField(fields.title, viewer)).toBe(true);
  });

  it("only denies on an explicit false from the matching predicate", () => {
    expect(canReadField(fields.internalNotes, viewer)).toBe(false);
    expect(canWriteField(fields.internalNotes, viewer)).toBe(true);
    expect(canReadField(fields.status, viewer)).toBe(true);
    expect(canWriteField(fields.status, viewer)).toBe(false);
  });

  it("passes the full context to the predicate", () => {
    let seen: FieldAccessContext | undefined;
    const field = string({
      access: {
        read: (ctx) => {
          seen = ctx;
          return true;
        },
      },
    });
    const ctx: FieldAccessContext = {
      principal: { id: "u9", email: "x@y.dev" },
      operation: "read",
      collection: "posts",
      documentId: "p1",
    };
    canReadField(field, ctx);
    expect(seen).toEqual(ctx);
  });
});
