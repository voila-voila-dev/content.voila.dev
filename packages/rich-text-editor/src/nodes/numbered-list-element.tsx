import { PlateElement, type PlateElementProps } from "platejs/react";

export function NumberedListElement(props: PlateElementProps) {
  return <PlateElement {...props} as="ol" />;
}
