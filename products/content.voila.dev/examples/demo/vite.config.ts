import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TanStack Start + Vite. The Start plugin wires file-based routing under
// `app/routes` and the server entry; nothing voila-specific lives here.
export default defineConfig({
  // Pin the port so the CLI next-steps and README URLs stay accurate.
  server: { port: 3000 },
  plugins: [tanstackStart({ srcDirectory: "app" }), react(), tailwindcss()],
});
