// The public site is rendered from the EXACT config the admin is built from —
// one schema, two front ends. Rather than duplicating (and drifting from) the
// collection definitions, this file re-exports the demo app's config: the demo
// owns `content.config.ts`, this app only reads through it.
//
// A relative import beats a workspace dependency here because the demo package
// declares no `exports` map (it's a private app, not a library), and both apps
// resolve `@voila/content` to the same hoisted workspace copy.

export { default } from "../demo.content.voila.dev/content.config";
