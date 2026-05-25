import { PlateElement, type PlateElementProps } from "platejs/react";

export function LinkElement(props: PlateElementProps) {
  const href = (props.element as { url?: string }).url;
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{ ...props.attributes, href } as PlateElementProps["attributes"]}
    >
      {props.children}
    </PlateElement>
  );
}
