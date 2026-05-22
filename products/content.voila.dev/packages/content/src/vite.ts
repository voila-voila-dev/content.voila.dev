import type { Plugin } from "vite";
import type { Content } from "./types.ts";

export type VoilaPluginOptions = {
  /**
   * Path to the `content.config.ts` file, relative to vite's project root.
   * Defaults to `./content.config.ts` (auto-discovery).
   *
   * Pass an already-resolved `Content` object to skip filesystem
   * discovery — useful for multi-tenant setups that build the config
   * dynamically.
   */
  config?: string | Content;
};

const DEFAULT_CONFIG_PATH = "./content.config.ts";

/**
 * The `@voila/content` vite plugin. Add to `vite.config.ts` alongside
 * `tanstackStart()` and the plugin will:
 *
 * - Auto-discover `./content.config.ts` (override via `config: '…'`).
 * - Register virtual TanStack Router routes for the admin (M0 ships
 *   admin shell, setup placeholder, and `/admin/api/health`; more land
 *   in later milestones).
 * - Expose `virtual:voila/content` so runtime code imports the resolved
 *   config from a stable specifier.
 *
 * The implementation is a stub at M0 — it establishes the plugin
 * contract; route registration and the virtual module land alongside
 * the playground app.
 */
export function voila(options: VoilaPluginOptions = {}): Plugin {
  const configSource = options.config ?? DEFAULT_CONFIG_PATH;
  return {
    name: "@voila/content",
    enforce: "pre",
    api: { configSource },
  };
}
