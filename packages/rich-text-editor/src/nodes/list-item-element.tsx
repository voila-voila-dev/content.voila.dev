import { PlateElement, type PlateElementProps } from "platejs/react";

export function ListItemElement(props: PlateElementProps) {
  return <PlateElement {...props} as="li" />;
}
