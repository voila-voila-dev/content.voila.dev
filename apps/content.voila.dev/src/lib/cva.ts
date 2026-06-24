import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

/**
 * Project-wide `cva` instance, configured so generated class strings are passed
 * through `tailwind-merge` — later Tailwind utilities win over earlier ones,
 * which is what you want when overriding variants via the `class` prop.
 */
export const { cva, cx, compose } = defineConfig({
  hooks: {
    onComplete: (className) => twMerge(className),
  },
});

export type { VariantProps } from "cva";
