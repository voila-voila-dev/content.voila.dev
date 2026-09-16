import { describe, expect, test } from "bun:test";
import { defineCollection, fields } from "@voila/content";
import { collectionOperations } from "./operations";

describe("collectionOperations", () => {
  test("every operation is on when the collection declares none", () => {
    const posts = defineCollection({ slug: "posts", fields: { title: fields.string() } });
    expect(collectionOperations(posts)).toEqual({ create: true, update: true, delete: true });
  });

  test("an empty operations block keeps the defaults", () => {
    expect(collectionOperations({ operations: {} })).toEqual({
      create: true,
      update: true,
      delete: true,
    });
  });

  test("only an explicit false turns a switch off", () => {
    expect(collectionOperations({ operations: { create: false } })).toEqual({
      create: false,
      update: true,
      delete: true,
    });
    expect(collectionOperations({ operations: { update: false, delete: false } })).toEqual({
      create: true,
      update: false,
      delete: false,
    });
  });

  test("an explicit true is honoured", () => {
    expect(collectionOperations({ operations: { create: true, delete: true } })).toEqual({
      create: true,
      update: true,
      delete: true,
    });
  });
});
