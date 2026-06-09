import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";

// TanStack Start + Vite. The Start plugin wires file-based routing under
// `app/routes` and the server entry; nothing voila-specific lives here.
export default defineConfig({
  plugins: [tanstackStart()],
});
