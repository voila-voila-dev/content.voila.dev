// A standalone renderer for the engine's `richText` value (programme notes,
// journal bodies, biographies, the about text).
//
// The stored value is a Plate/Slate-shaped node tree: a top-level array of
// elements (`{ id, type, children }`) whose leaves are `{ text, ...marks }`.
// The admin renders it through the Plate editor package; a public site has no
// business shipping an editor to a reader, so this walks the same node shape
// into plain React elements — no library, no `dangerouslySetInnerHTML`, and
// unknown node kinds degrade to their text rather than disappearing.
//
// Two list conventions both appear in the wild and both are handled: explicit
// `bullet-list` / `ordered-list` containers of `list-item`s, and the indent-list
// convention where consecutive `paragraph`s carry `listStyleType`.

import type { ReactNode } from "react";

interface ElementNode {
  readonly type?: unknown;
  readonly children?: unknown;
  readonly [key: string]: unknown;
}

const MARK_WRAPPERS: ReadonlyArray<readonly [string, (child: ReactNode) => ReactNode]> = [
  ["bold", (c) => <strong className="font-semibold">{c}</strong>],
  ["italic", (c) => <em>{c}</em>],
  ["underline", (c) => <u>{c}</u>],
  ["strikethrough", (c) => <s>{c}</s>],
  ["code", (c) => <code>{c}</code>],
  ["highlight", (c) => <mark className="bg-(--accent)/25 text-bone">{c}</mark>],
  ["kbd", (c) => <kbd>{c}</kbd>],
  ["subscript", (c) => <sub>{c}</sub>],
  ["superscript", (c) => <sup>{c}</sup>],
];

function isElement(node: unknown): node is ElementNode {
  return typeof node === "object" && node !== null && !Array.isArray(node);
}

function isLeaf(node: unknown): node is { text: string } {
  return isElement(node) && typeof node.text === "string";
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A text leaf plus its marks, applied outermost-first so nesting is stable. */
function renderLeaf(leaf: { text: string }, key: string): ReactNode {
  let out: ReactNode = leaf.text;
  for (const [mark, wrap] of MARK_WRAPPERS) {
    if ((leaf as Record<string, unknown>)[mark]) out = wrap(out);
  }
  return <span key={key}>{out}</span>;
}

function renderChildren(children: unknown, keyPrefix: string): ReactNode {
  if (!Array.isArray(children)) return null;
  return children.map((child, index) => renderNode(child, `${keyPrefix}.${index}`));
}

/** External links open in a new tab; anything else stays in the site. */
function renderLink(node: ElementNode, key: string): ReactNode {
  const href = str(node.url) ?? "#";
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      key={key}
      href={href}
      title={str(node.title)}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {renderChildren(node.children, key)}
    </a>
  );
}

function renderNode(node: unknown, key: string): ReactNode {
  if (isLeaf(node)) return renderLeaf(node, key);
  if (!isElement(node)) return null;

  const kids = renderChildren(node.children, key);
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{kids}</p>;
    case "heading-1":
      return <h2 key={key}>{kids}</h2>;
    case "heading-2":
      return <h3 key={key}>{kids}</h3>;
    case "heading-3":
    case "heading-4":
    case "heading-5":
    case "heading-6":
      return <h4 key={key}>{kids}</h4>;
    case "blockquote":
      return (
        <blockquote key={key} cite={str(node.cite)}>
          {kids}
        </blockquote>
      );
    case "bullet-list":
      return <ul key={key}>{kids}</ul>;
    case "ordered-list":
      return (
        <ol key={key} start={typeof node.start === "number" ? node.start : undefined}>
          {kids}
        </ol>
      );
    case "list-item":
      return <li key={key}>{kids}</li>;
    case "code-block":
      return (
        <pre key={key}>
          <code>{kids}</code>
        </pre>
      );
    case "horizontal-rule":
      return <hr key={key} />;
    case "link":
      return renderLink(node, key);
    case "image": {
      const url = str(node.url);
      if (!url) return null;
      return (
        <figure key={key}>
          <img
            src={url}
            alt={str(node.alt) ?? ""}
            width={typeof node.width === "number" ? node.width : undefined}
            height={typeof node.height === "number" ? node.height : undefined}
            className="w-full border border-rule"
            loading="lazy"
          />
          {str(node.caption) ? <figcaption>{node.caption as string}</figcaption> : null}
        </figure>
      );
    }
    // `mention`, `callout`, tables and the placeholder kinds have no public
    // treatment yet — render their text so nothing is silently dropped.
    default:
      return <p key={key}>{kids}</p>;
  }
}

/** Ordered-vs-bulleted for the indent-list convention. */
function isOrdered(style: unknown): boolean {
  return (
    style === "decimal" ||
    style === "lower-alpha" ||
    style === "upper-alpha" ||
    style === "lower-roman" ||
    style === "upper-roman"
  );
}

/**
 * Fold runs of `listStyleType`-bearing paragraphs into real lists, leaving every
 * other top-level node untouched. Returns rendered nodes, in order.
 */
function renderBlocks(nodes: ReadonlyArray<unknown>): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ElementNode[] = [];

  const flush = (at: number) => {
    if (run.length === 0) return;
    const first = run[0];
    const ordered = isOrdered(first?.listStyleType);
    const items = run.map((item, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: nodes carry no stable id here
      <li key={`li.${at}.${index}`}>{renderChildren(item.children, `li.${at}.${index}`)}</li>
    ));
    out.push(ordered ? <ol key={`list.${at}`}>{items}</ol> : <ul key={`list.${at}`}>{items}</ul>);
    run = [];
  };

  nodes.forEach((node, index) => {
    if (isElement(node) && node.type === "paragraph" && str(node.listStyleType)) {
      run.push(node);
      return;
    }
    flush(index);
    out.push(renderNode(node, `n.${index}`));
  });
  flush(nodes.length);
  return out;
}

export interface RichTextProps {
  readonly value: unknown;
  /** Extra classes on the wrapper — spacing is the caller's business. */
  readonly className?: string;
}

/** Renders a rich-text document, or nothing at all when it's empty. */
export function RichText({ value, className }: RichTextProps): ReactNode {
  if (!Array.isArray(value) || value.length === 0) return null;
  return (
    <div className={className ? `prose-vertigo ${className}` : "prose-vertigo"}>
      {renderBlocks(value)}
    </div>
  );
}

/** Flatten a rich-text document to plain text — for meta descriptions and the
 *  one-line summaries a listing shows when no excerpt was written. */
export function richTextToPlain(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const walk = (node: unknown): string => {
    if (isLeaf(node)) return node.text;
    if (isElement(node) && Array.isArray(node.children)) return node.children.map(walk).join("");
    return "";
  };
  return value.map(walk).join(" ").replace(/\s+/g, " ").trim();
}
