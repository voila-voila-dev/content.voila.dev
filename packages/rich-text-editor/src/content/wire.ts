// The bidirectional, lossless adapter between the `@voila/content` engine's
// rich-text **wire format** (the stored, validated JSON — long type names,
// required `id` on every element) and **Plate's editor value** (short type
// names, the classic `ul > li > lic` list shape, no ids by default).
//
// The wire format is the source of truth: a `richText()` field builds a
// recursive validator from its allowed elements/marks, so whatever the editor
// emits must decode against that schema or the write 422s. This module is the
// single canonical translation; the vended widget stays thin glue on top of it.
//
// It is deliberately framework-free (no `platejs/react`, no React) so the
// roundtrip can be tested without a DOM. The component + plugin wiring lives in
// `./capabilities`.

import type { rt } from "@voila/content";
import type { Descendant, TElement, Value } from "platejs";

/** The Plate node key the classic list plugin wraps `<li>` text in. */
export const LIST_ITEM_CONTENT_TYPE = "lic";

/**
 * The Plate node key that carries a wire element the editor cannot edit. It is
 * rendered as a read-only void block; `toWire` unwraps it byte-identical so the
 * preserved node survives an edit session untouched.
 */
export const UNSUPPORTED_TYPE = "voila_unsupported";

/** Where {@link UNSUPPORTED_TYPE} stashes the verbatim original wire element. */
export const ORIGINAL_NODE_KEY = "voilaOriginal";

/**
 * Wire element type → Plate element type. The keys are exactly the element
 * kinds the editor can edit (the E1 subset); every other wire type is preserved
 * opaquely via {@link UNSUPPORTED_TYPE} rather than mapped. `list-item` is in
 * the map but is special-cased for the `lic` wrapper (see {@link fromWireList}).
 */
export const WIRE_TO_PLATE: Readonly<Record<string, string>> = {
  paragraph: "p",
  "heading-1": "h1",
  "heading-2": "h2",
  "heading-3": "h3",
  blockquote: "blockquote",
  "bullet-list": "ul",
  "ordered-list": "ol",
  "list-item": "li",
  link: "a",
};

/** Plate element type → wire element type (inverse of {@link WIRE_TO_PLATE}). */
export const PLATE_TO_WIRE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(WIRE_TO_PLATE).map(([wire, plate]) => [plate, wire]),
);

/** The wire mark keys the editor can toggle. Other marks ride along verbatim. */
export const SUPPORTED_MARKS: ReadonlyArray<string> = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
];

type AnyRecord = Record<string, unknown>;

function isElementNode(node: unknown): node is AnyRecord & { type: string; children: unknown[] } {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as AnyRecord).type === "string" &&
    Array.isArray((node as AnyRecord).children)
  );
}

function isList(type: string): boolean {
  return type === "bullet-list" || type === "ordered-list";
}

// ---------------------------------------------------------------------------
// wire → Plate
// ---------------------------------------------------------------------------

/**
 * Decodes a validated wire document into a Plate editor value. Known elements
 * are renamed to their Plate type, list items gain the `lic` wrapper, and any
 * element whose type the editor cannot edit is wrapped in an opaque void node
 * (preserved verbatim under {@link ORIGINAL_NODE_KEY}). Leaves — including marks
 * the editor doesn't support — pass through untouched.
 */
export function fromWire(value: rt.RichTextValue): Value {
  return (value as ReadonlyArray<unknown>).map(fromWireNode) as Value;
}

function fromWireNode(node: unknown): Descendant {
  if (!isElementNode(node)) return { ...(node as AnyRecord) } as Descendant;

  const plateType = WIRE_TO_PLATE[node.type];
  if (plateType === undefined) {
    // Unsupported element: stash it verbatim inside a void block so it cannot
    // be mangled by Slate's normalizer and round-trips byte-identical.
    const wrapper: AnyRecord = {
      type: UNSUPPORTED_TYPE,
      [ORIGINAL_NODE_KEY]: node,
      children: [{ text: "" }],
    };
    if (typeof node.id === "string") wrapper.id = node.id;
    return wrapper as Descendant;
  }

  if (node.type === "list-item") return fromWireList(node, plateType);

  const { type: _type, children, ...rest } = node;
  return {
    ...rest,
    type: plateType,
    children: children.map(fromWireNode),
  } as Descendant;
}

/**
 * `list-item` → `li`. Classic Plate lists wrap a list item's inline content in
 * a `lic` node, then carry any nested lists as siblings of that wrapper. Each
 * contiguous run of non-list children becomes one `lic`; nested lists are
 * mapped in place. `toWire` unwraps every `lic` in place, so the transform is a
 * clean bijection even when inline content and nested lists interleave.
 */
function fromWireList(
  node: AnyRecord & { type: string; children: ReadonlyArray<unknown> },
  plateType: string,
): Descendant {
  const { type: _type, children, ...rest } = node;
  const out: Descendant[] = [];
  let run: Descendant[] = [];
  const flush = () => {
    if (run.length === 0) return;
    out.push({ type: LIST_ITEM_CONTENT_TYPE, children: run } as unknown as Descendant);
    run = [];
  };
  for (const child of children) {
    if (isElementNode(child) && isList(child.type)) {
      flush();
      out.push(fromWireNode(child));
    } else {
      run.push(fromWireNode(child));
    }
  }
  flush();
  return { ...rest, type: plateType, children: out } as Descendant;
}

// ---------------------------------------------------------------------------
// Plate → wire
// ---------------------------------------------------------------------------

export interface ToWireOptions {
  /**
   * Mints ids for elements the editor created without one (splits, merges,
   * autoformat, paste). Defaults to `crypto.randomUUID`. Injected for
   * deterministic tests.
   */
  readonly generateId?: () => string;
}

/**
 * Encodes a Plate editor value back into the wire format. Known elements are
 * renamed to their long wire type, `lic` wrappers are flattened, preserved void
 * blocks are restored verbatim, and every element is guaranteed an `id`
 * (existing ones kept, missing ones minted) so the result always validates.
 */
export function toWire(value: Value, opts?: ToWireOptions): rt.RichTextValue {
  const generateId = opts?.generateId ?? defaultGenerateId;
  return (value as Descendant[]).map((node) => toWireNode(node, generateId)) as rt.RichTextValue;
}

function defaultGenerateId(): string {
  return crypto.randomUUID();
}

function toWireNode(node: Descendant, generateId: () => string): rt.RichTextNode {
  if (!isElementNode(node)) return { ...(node as AnyRecord) } as rt.RichTextNode;

  // Preserved unsupported block → restore the stashed original untouched.
  if (node.type === UNSUPPORTED_TYPE) {
    return (node as AnyRecord)[ORIGINAL_NODE_KEY] as rt.RichTextNode;
  }

  if (node.type === "li") return toWireList(node, generateId);

  const wireType = PLATE_TO_WIRE[node.type] ?? node.type;
  return encodeElement(node, wireType, (node as TElement).children, generateId);
}

/** `li` → `list-item`, unwrapping each `lic` wrapper in place. */
function toWireList(node: Descendant, generateId: () => string): rt.RichTextNode {
  const children: rt.RichTextNode[] = [];
  for (const child of (node as TElement).children) {
    if (isElementNode(child) && child.type === LIST_ITEM_CONTENT_TYPE) {
      for (const grandchild of child.children as Descendant[]) {
        children.push(toWireNode(grandchild, generateId));
      }
    } else {
      children.push(toWireNode(child as Descendant, generateId));
    }
  }
  return encodeElement(node, "list-item", children as unknown as Descendant[], generateId, true);
}

function encodeElement(
  node: Descendant,
  wireType: string,
  children: ReadonlyArray<Descendant>,
  generateId: () => string,
  childrenAlreadyEncoded = false,
): rt.RichTextElement {
  const { type: _type, children: _children, ...rest } = node as AnyRecord;
  const id = typeof rest.id === "string" ? rest.id : generateId();
  const encodedChildren = childrenAlreadyEncoded
    ? (children as unknown as rt.RichTextNode[])
    : children.map((child) => toWireNode(child, generateId));
  return {
    ...rest,
    id,
    type: wireType,
    children: encodedChildren,
  } as rt.RichTextElement;
}
