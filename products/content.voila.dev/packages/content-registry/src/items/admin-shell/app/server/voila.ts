// VENDED by @voila/content-registry — you own this file.
// Thin engine mount. Add middleware / extra routes here.
import { makeHandler } from "@voila/content/server";
import config from "~/content.config";

export const voilaHandler = makeHandler(config);
