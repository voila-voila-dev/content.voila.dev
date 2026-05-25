import { PlateLeaf, type PlateLeafProps } from "platejs/react";

// `as` swaps the wrapping element so the rendered DOM carries a semantic tag
// (<strong>) that HTML serialization can rely on.
export function BoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="strong" />;
}
