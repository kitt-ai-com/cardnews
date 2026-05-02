import * as React from "react";

/**
 * Convert a copy string with inline markup to React nodes.
 * Supported markup:
 *   <accent>...</accent>  → span with color: var(--color-accent)
 *   <code>...</code>      → inline code chip with lime background
 *   <br>                  → line break
 *   <b>...</b>            → bold span (color: var(--color-accent))
 *
 * Note: this is intentionally a simple regex-based parser for these specific
 * tags. It does NOT support nested tags of the same kind (a single level of
 * tags is sufficient for the cardnews copy format).
 */
const TAG_RE = /<(accent|code|b)>([\s\S]*?)<\/\1>|<br\s*\/?\s*>/gi;

interface CodeChipStyle {
  color: string;
  backgroundColor: string;
  padding: string;
  borderRadius: string;
  fontFamily: string;
}

const codeChipStyle: CodeChipStyle = {
  color: "var(--color-bg)",
  backgroundColor: "var(--color-accent)",
  padding: "0 0.3em",
  borderRadius: "0.2em",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index));
    }
    const [matched, tagName, inner] = m;
    if (matched.toLowerCase().startsWith("<br")) {
      nodes.push(<br key={`k${key++}`} />);
    } else {
      const lower = (tagName || "").toLowerCase();
      if (lower === "accent") {
        nodes.push(
          <span key={`k${key++}`} style={{ color: "var(--color-accent)" }}>
            {inner}
          </span>
        );
      } else if (lower === "code") {
        nodes.push(
          <span key={`k${key++}`} style={codeChipStyle}>
            {inner}
          </span>
        );
      } else if (lower === "b") {
        nodes.push(
          <span
            key={`k${key++}`}
            style={{
              color: "var(--color-accent)",
              fontWeight: 700,
            }}
          >
            {inner}
          </span>
        );
      }
    }
    lastIndex = TAG_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
