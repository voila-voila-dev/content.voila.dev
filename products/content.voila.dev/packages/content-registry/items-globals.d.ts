// Ambient declarations for typechecking vended item sources. The widgets import
// the editor's bundled stylesheet as a side effect; Vite handles it in the
// consumer app, so tsc only needs to know the module exists.
declare module "*.css";
