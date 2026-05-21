// Re-export of @phosphor-icons/react.
//
// One subpath (`@voila/ui/icons`) so callers don't pin the upstream package
// directly — keeps the icon set swappable and lets us add wrappers later
// (default weight, fallbacks) without touching call sites.

export * from "@phosphor-icons/react";
