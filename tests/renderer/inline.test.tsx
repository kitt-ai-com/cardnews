import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInline } from "../../src/renderer/inline";

function html(node: React.ReactNode): string {
  return renderToStaticMarkup(<>{node}</>);
}

describe("renderInline", () => {
  it("converts <accent>...</accent> to span with accent color var", () => {
    const out = html(renderInline("hello <accent>world</accent>!"));
    expect(out).toContain("hello ");
    expect(out).toContain("color:var(--color-accent)");
    expect(out).toContain("world");
    expect(out).toContain("!");
  });

  it("converts <code>X</code> to a styled inline span", () => {
    const out = html(renderInline("see <code>npm install</code>"));
    expect(out).toContain("npm install");
    // code chip has accent background
    expect(out).toContain("background-color:var(--color-accent)");
    expect(out).toContain("font-family:");
  });

  it("converts <br> to a <br /> element", () => {
    const out = html(renderInline("line1<br>line2"));
    expect(out).toContain("line1");
    expect(out).toContain("<br/>");
    expect(out).toContain("line2");
  });

  it("converts <br/> (self-closing) to a <br /> element", () => {
    const out = html(renderInline("a<br/>b"));
    expect(out).toContain("<br/>");
  });

  it("passes plain text through unchanged", () => {
    const out = html(renderInline("just plain text 한국어"));
    expect(out).toBe("just plain text 한국어");
  });

  it("handles <b>...</b> as bold accent span", () => {
    const out = html(renderInline("a <b>strong</b> b"));
    expect(out).toContain("strong");
    expect(out).toContain("font-weight:700");
    expect(out).toContain("color:var(--color-accent)");
  });

  it("supports multiple tags in same string", () => {
    const out = html(
      renderInline("<accent>A</accent> and <code>B</code> and <b>C</b>")
    );
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out).toContain("C");
  });
});
