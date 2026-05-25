import { PlateElement, type PlateElementProps } from "platejs/react";

export function H1Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" />;
}
