import { PlateLeaf, type PlateLeafProps } from "platejs/react";

// Renders as <s> so HTML serialization carries the semantic tag.
export function StrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="s" />;
}
