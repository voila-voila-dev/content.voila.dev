// Locale identifier — branded string used by localized fields in
// @voila/content. Kept here (L1) so every layer above can refer to it without
// pulling the runtime brain.

import type { Brand } from "effect";

/**
 * A locale identifier (e.g. `"en"`, `"en-US"`, `"fr"`).
 *
 * Branded so callers cannot accidentally pass an arbitrary string where a
 * locale is expected.
 */
export type Locale = string & Brand.Brand<"Locale">;
