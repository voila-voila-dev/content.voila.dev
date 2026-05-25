import { PlateElement, type PlateElementProps } from "platejs/react";

export function BlockquoteElement(props: PlateElementProps) {
  return <PlateElement {...props} as="blockquote" />;
}
