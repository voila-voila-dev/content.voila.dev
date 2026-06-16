// A document as the admin UI handles it: a decoded row from the typed client
// or a form's field values, keyed by field name. The components are
// config-driven rather than generic over a collection's inferred type, so this
// alias is the one place the "loosely typed record" shape is spelled out.

export type Doc = Record<string, unknown>;
