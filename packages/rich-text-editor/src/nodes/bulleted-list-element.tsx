import { PlateElement, type PlateElementProps } from "platejs/react";

export function BulletedListElement(props: PlateElementProps) {
  return <PlateElement {...props} as="ul" />;
}
