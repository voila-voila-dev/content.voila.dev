// A presentation-light inline combobox — the shared dropdown both the slash
// menu and the @-mention picker render into. It is the standard Plate pattern
// (Ariakit's combobox store driving `@platejs/combobox`'s input lifecycle), but
// stripped of plate-ui's Tailwind/`cva`/`cn` deps: chrome is plain
// `voila-rich-text-combobox*` classes styled in `./styles.css`, so the editor
// package stays framework-agnostic. The trigger plugins (`slash_input`,
// `mention_input`) insert an inline void element as the user types the trigger
// char; this component lives inside that element and turns its text into a
// filtered, keyboard-navigable list.

import {
  Combobox,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  type ComboboxItemProps,
  ComboboxPopover,
  ComboboxProvider,
  Portal,
  useComboboxContext,
  useComboboxStore,
} from "@ariakit/react";
import { filterWords } from "@platejs/combobox";
import {
  type UseComboboxInputResult,
  useComboboxInput,
  useHTMLInputCursorState,
} from "@platejs/combobox/react";
import type { PointRef, TElement } from "platejs";
import { useComposedRef, useEditorRef } from "platejs/react";
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Joins truthy class fragments — a `cn` stand-in with no dependency. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type FilterFn = (
  item: { value: string; group?: string; keywords?: string[]; label?: string },
  search: string,
) => boolean;

interface InlineComboboxContextValue {
  filter: FilterFn | false;
  inputProps: UseComboboxInputResult["props"];
  inputRef: RefObject<HTMLInputElement | null>;
  removeInput: UseComboboxInputResult["removeInput"];
  showTrigger: boolean;
  trigger: string;
  setHasEmpty: (hasEmpty: boolean) => void;
}

const InlineComboboxContext = createContext<InlineComboboxContextValue>(
  null as unknown as InlineComboboxContextValue,
);

/** Default fuzzy match across an item's value, keywords, group, and label. */
const defaultFilter: FilterFn = ({ group, keywords = [], label, value }, search) => {
  const uniqueTerms = new Set([value, ...keywords, group, label].filter(Boolean));
  return Array.from(uniqueTerms).some((keyword) => filterWords(keyword as string, search));
};

interface InlineComboboxProps {
  children: ReactNode;
  element: TElement;
  trigger: string;
  filter?: FilterFn | false;
  hideWhenNoValue?: boolean;
  showTrigger?: boolean;
  value?: string;
  setValue?: (value: string) => void;
}

export function InlineCombobox({
  children,
  element,
  filter = defaultFilter,
  hideWhenNoValue = false,
  setValue: setValueProp,
  showTrigger = true,
  trigger,
  value: valueProp,
}: InlineComboboxProps): ReactNode {
  const editor = useEditorRef();
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);

  const [valueState, setValueState] = useState("");
  const hasValueProp = valueProp !== undefined;
  const value = hasValueProp ? valueProp : valueState;

  const setValue = useCallback(
    (newValue: string) => {
      setValueProp?.(newValue);
      if (!hasValueProp) setValueState(newValue);
    },
    [setValueProp, hasValueProp],
  );

  // Track the point just before the input so we can re-insert the literal
  // "trigger + text" there if the combobox closes without a selection.
  const insertPointRef = useRef<PointRef | null>(null);

  useEffect(() => {
    insertPointRef.current?.unref();
    insertPointRef.current = null;
    const path = editor.api.findPath(element);
    if (!path) return;
    const point = editor.api.before(path);
    if (!point) return;
    const pointRef = editor.api.pointRef(point);
    insertPointRef.current = pointRef;
    return () => {
      if (insertPointRef.current === pointRef) insertPointRef.current = null;
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    cancelInputOnBlur: true,
    cursorState,
    ref: inputRef,
    onCancelInput: (cause) => {
      if (cause !== "backspace") {
        editor.tf.insertText(trigger + value, {
          at: insertPointRef.current?.current ?? undefined,
        });
      }
      if (cause === "arrowLeft" || cause === "arrowRight") {
        editor.tf.move({ distance: 1, reverse: cause === "arrowLeft" });
      }
    },
  });

  const [hasEmpty, setHasEmpty] = useState(false);

  const contextValue = useMemo<InlineComboboxContextValue>(
    () => ({ filter, inputProps, inputRef, removeInput, setHasEmpty, showTrigger, trigger }),
    [trigger, showTrigger, filter, inputProps, removeInput],
  );

  const store = useComboboxStore({
    setValue: (newValue) => startTransition(() => setValue(newValue)),
  });
  const items = store.useState("items");

  // Keep the first item active so Enter always has a target.
  useEffect(() => {
    if (!store.getState().activeId) store.setActiveId(store.first());
  }, [items, store]);

  return (
    <span contentEditable={false}>
      <ComboboxProvider
        open={(items.length > 0 || hasEmpty) && (!hideWhenNoValue || value.length > 0)}
        store={store}
      >
        <InlineComboboxContext.Provider value={contextValue}>
          {children}
        </InlineComboboxContext.Provider>
      </ComboboxProvider>
    </span>
  );
}

export function InlineComboboxInput({
  className,
  ref: propRef,
  ...props
}: HTMLAttributes<HTMLInputElement> & {
  ref?: RefObject<HTMLInputElement | null>;
}): ReactNode {
  const {
    inputProps,
    inputRef: contextRef,
    showTrigger,
    trigger,
  } = useContext(InlineComboboxContext);
  const store = useComboboxContext();
  const value = store?.useState("value");
  const ref = useComposedRef(propRef, contextRef);

  // A visually-hidden mirror sizes the absolutely-positioned input to its text.
  return (
    <>
      {showTrigger && trigger}
      <span className="voila-rich-text-combobox-input-wrap">
        <span className="voila-rich-text-combobox-input-mirror" aria-hidden="true">
          {value || "​"}
        </span>
        <Combobox
          ref={ref}
          className={cx("voila-rich-text-combobox-input", className)}
          value={value}
          autoSelect
          {...inputProps}
          {...props}
        />
      </span>
    </>
  );
}

export function InlineComboboxContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): ReactNode {
  const store = useComboboxContext();

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!store) return;
    const { items, activeId } = store.getState();
    if (!items.length) return;
    const currentIndex = items.findIndex((item) => item.id === activeId);
    if (event.key === "ArrowUp" && currentIndex <= 0) {
      event.preventDefault();
      store.setActiveId(store.last());
    } else if (event.key === "ArrowDown" && currentIndex >= items.length - 1) {
      event.preventDefault();
      store.setActiveId(store.first());
    }
  }

  return (
    <Portal>
      <ComboboxPopover
        className={cx("voila-rich-text-combobox-popover", className)}
        onKeyDownCapture={handleKeyDown}
        {...props}
      />
    </Portal>
  );
}

export function InlineComboboxItem({
  className,
  focusEditor = true,
  group,
  keywords,
  label,
  onClick,
  ...props
}: {
  focusEditor?: boolean;
  group?: string;
  keywords?: string[];
  label?: string;
} & ComboboxItemProps &
  Required<Pick<ComboboxItemProps, "value">>): ReactNode {
  const { value } = props;
  const { filter, removeInput } = useContext(InlineComboboxContext);
  const store = useComboboxContext();
  // Don't subscribe to the search value when filtering is disabled.
  const search = filter && store?.useState("value");

  const visible = useMemo(
    () => !filter || filter({ group, keywords, label, value }, search as string),
    [filter, group, keywords, label, value, search],
  );
  if (!visible) return null;

  return (
    <ComboboxItem
      className={cx("voila-rich-text-combobox-item", className)}
      onClick={(event) => {
        removeInput(focusEditor);
        onClick?.(event);
      }}
      {...props}
    />
  );
}

export function InlineComboboxEmpty({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>): ReactNode {
  const { setHasEmpty } = useContext(InlineComboboxContext);
  const store = useComboboxContext();
  const items = store?.useState("items") ?? [];

  useEffect(() => {
    setHasEmpty(true);
    return () => setHasEmpty(false);
  }, [setHasEmpty]);

  if (items.length > 0) return null;
  return (
    <div
      className={cx("voila-rich-text-combobox-item", "voila-rich-text-combobox-empty", className)}
    >
      {children}
    </div>
  );
}

export function InlineComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroup>): ReactNode {
  return <ComboboxGroup {...props} className={cx("voila-rich-text-combobox-group", className)} />;
}

export function InlineComboboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroupLabel>): ReactNode {
  return (
    <ComboboxGroupLabel
      {...props}
      className={cx("voila-rich-text-combobox-group-label", className)}
    />
  );
}
