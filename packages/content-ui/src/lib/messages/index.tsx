// Messages — the admin chrome's words, in the admin's language. Every visible
// string the kit renders ("Save", "Showing 3 of 12", "Sign out") comes from a
// catalog read with `useMessages()`, so `defineAdmin({ locale: "fr-FR" })`
// switches the whole admin to French. Content (labels, descriptions) is the
// project's own and is never translated here.
//
// Catalogs are split by area (one file each) and merged below. A message is a
// string or, when it interpolates, a function — plurals are the function's
// business (`Intl.PluralRules` is overkill for two languages). Components
// outside a `MessagesProvider` get English, so every block stays usable alone.

import { createContext, type ReactNode, useContext } from "react";
import * as admin from "./admin";
import * as common from "./common";
import * as form from "./form";
import * as list from "./list";
import * as shell from "./shell";

export const en = {
  common: common.en,
  shell: shell.en,
  list: list.en,
  form: form.en,
  admin: admin.en,
};

export type Messages = typeof en;

export const fr: Messages = {
  common: common.fr,
  shell: shell.fr,
  list: list.fr,
  form: form.fr,
  admin: admin.fr,
};

/** The built-in catalogs, keyed by language subtag. */
export const catalogs: Readonly<Record<string, Messages>> = { en, fr };

/** A partial override: any area, any key. */
export type MessageOverrides = {
  readonly [A in keyof Messages]?: Partial<Messages[A]>;
};

/**
 * Pick the catalog for a BCP 47 locale (`"fr-FR"` → French) and layer the
 * caller's overrides on top. Unknown or missing locales fall back to English.
 */
export function resolveMessages(locale?: string, overrides?: MessageOverrides): Messages {
  const language = locale?.toLowerCase().split(/[-_]/)[0] ?? "en";
  const base = catalogs[language] ?? en;
  if (!overrides) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const [area, values] of Object.entries(overrides)) {
    merged[area] = { ...(base as Record<string, object>)[area], ...values };
  }
  return merged as Messages;
}

const MessagesContext = createContext<Messages>(en);

export interface MessagesProviderProps {
  readonly messages: Messages;
  readonly children?: ReactNode;
}

export function MessagesProvider({ messages, children }: MessagesProviderProps): ReactNode {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** The admin chrome's messages (English outside a provider). */
export function useMessages(): Messages {
  return useContext(MessagesContext);
}
