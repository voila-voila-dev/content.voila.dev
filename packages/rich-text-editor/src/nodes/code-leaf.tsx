import { PlateLeaf, type PlateLeafProps } from "platejs/react";

// Renders as <code> so HTML serialization carries the semantic tag.
export function CodeLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="code" />;
}
