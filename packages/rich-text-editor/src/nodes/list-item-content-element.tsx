import { PlateElement, type PlateElementProps } from "platejs/react";

// The list-item-content node wraps the text inside an <li>; render it as a
// transparent block so the DOM stays <li><div>…</div></li>.
export function ListItemContentElement(props: PlateElementProps) {
  return <PlateElement {...props} as="div" />;
}
