/**
 * Tiny TipTap JSONContent builders for seeded rich-text documents (rationale
 * memos, drafted responses). Plain objects only — no tiptap dependency.
 */

export interface InlineNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string }>;
}

export const text = (value: string): InlineNode => ({ type: "text", text: value });

export const bold = (value: string): InlineNode => ({
  type: "text",
  text: value,
  marks: [{ type: "bold" }],
});

export const italic = (value: string): InlineNode => ({
  type: "text",
  text: value,
  marks: [{ type: "italic" }],
});

export const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

export const paragraph = (...children: Array<InlineNode | string>) => ({
  type: "paragraph",
  content: children.map((child) =>
    typeof child === "string" ? text(child) : child,
  ),
});

export const bullets = (items: Array<Array<InlineNode | string>>) => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(...item)],
  })),
});
