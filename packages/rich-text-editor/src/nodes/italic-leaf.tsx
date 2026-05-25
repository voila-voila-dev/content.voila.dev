import { PlateLeaf, type PlateLeafProps } from "platejs/react";

// Renders as <em> so HTML serialization carries the semantic tag.
export function ItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="em" />;
}
