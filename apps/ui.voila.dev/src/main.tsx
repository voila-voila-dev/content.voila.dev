import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@voila/ui/tailwind";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <main className="p-8 font-sans text-foreground">
      <h1 className="text-2xl font-semibold">@voila/ui storybook</h1>
      <p className="text-muted-foreground mt-2">
        Run <code className="font-mono">bun run storybook</code> to browse primitives.
      </p>
    </main>
  </StrictMode>,
);
