import { PlateElement, type PlateElementProps } from "platejs/react";

export function H2Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h2" />;
}
