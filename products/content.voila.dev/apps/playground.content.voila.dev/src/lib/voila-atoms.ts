// VENDED by @voila/content-registry — you own this file.
// The per-collection reactive atom set, derived from the typed config and bound
// to the RPC endpoint the worker serves. Components read `voila.collections.<slug>`
// via `useAtomValue`. In M3 the backend swaps to LiveStore with the same shape —
// this file is the only thing that changes.
import { makeVoilaAtoms } from "@voila/content/client/atoms";
import config from "~/content.config";

export const voila = makeVoilaAtoms(config, { url: "/admin/api/rpc" });
export const collections = voila.collections;
