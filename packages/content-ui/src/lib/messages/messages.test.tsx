import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SearchInput } from "../../search-input";
import { en, fr, MessagesProvider, resolveMessages } from "./index";

afterEach(cleanup);

/** Every key of `en`, recursively, as dotted paths. */
function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("messages", () => {
  test("the French catalog covers every English key", () => {
    expect(keys(fr)).toEqual(keys(en));
  });

  test("picks the catalog from the locale's language", () => {
    expect(resolveMessages("fr-FR")).toBe(fr);
    expect(resolveMessages("fr")).toBe(fr);
    expect(resolveMessages("en-GB")).toBe(en);
    expect(resolveMessages("de-DE")).toBe(en);
    expect(resolveMessages()).toBe(en);
  });

  test("layers overrides over the catalog", () => {
    const m = resolveMessages("fr-FR", { common: { save: "Publier" } });
    expect(m.common.save).toBe("Publier");
    expect(m.common.cancel).toBe("Annuler");
    expect(fr.common.save).toBe("Enregistrer");
  });

  test("components render the provided catalog", () => {
    render(
      <MessagesProvider messages={fr}>
        <SearchInput value="" onChange={() => {}} />
      </MessagesProvider>,
    );
    expect(screen.getByRole("searchbox", { name: "Rechercher" })).toBeTruthy();
  });
});
