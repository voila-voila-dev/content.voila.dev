import { PlateLeaf, type PlateLeafProps } from "platejs/react";

// Renders as <u> so HTML serialization carries the semantic tag.
export function UnderlineLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="u" />;
}
