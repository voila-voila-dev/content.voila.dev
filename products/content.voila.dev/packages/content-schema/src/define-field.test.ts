import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { VoilaField } from "./annotation.ts";
import { defineField } from "./define-field.ts";
import { getFieldMeta } from "./get-field-meta.ts";

describe("defineField", () => {
  it("registers a custom kind whose meta carries the registered name", () => {
    interface ColorOpts {
      readonly required?: boolean;
    }
    const color = defineField<ColorOpts, string>("color", (opts) =>
      Schema.String.pipe(
        Schema.pattern(/^#[0-9a-f]{6}$/i),
        Schema.annotations({
          [VoilaField]: { kind: "color", widget: "color-picker", required: opts.required },
        }),
      ),
    );

    const f = color({ required: true });
    expect(Schema.decodeUnknownSync(f)("#aabbcc")).toBe("#aabbcc");
    expect(() => Schema.decodeUnknownSync(f)("not-a-color")).toThrow();
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({ kind: "color", widget: "color-picker", required: true });
  });

  it("attaches a default meta when the factory forgets one", () => {
    const bare = defineField<void, string>("bare", () => Schema.String);
    const f = bare();
    const meta = getFieldMeta(f);
    expect(meta).not.toBeNull();
    expect(meta?.kind).toBe("bare");
    expect(meta?.widget).toBe("bare");
  });

  it("overrides a mismatched kind to match the registered one", () => {
    const wrong = defineField<void, string>("right", () =>
      Schema.String.pipe(Schema.annotations({ [VoilaField]: { kind: "wrong", widget: "wrong" } })),
    );
    const meta = getFieldMeta(wrong());
    expect(meta?.kind).toBe("right");
  });
});
