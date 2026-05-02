import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P2 from "../../../src/renderer/layouts/P2";
import { makePreset, makeSeries, makeP2Page } from "../_fixtures";

describe("P2 layout", () => {
  it("renders title + 3 columns parsed from pipe-encoded list", () => {
    const html = renderToStaticMarkup(
      <P2
        page={makeP2Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("셋의 역할은");
    expect(html).toContain("스킬");
    expect(html).toContain("훅");
    expect(html).toContain("루프");
    // exactly 3 col cards
    const colMatches = html.match(/data-cn-role="p2-col"/g);
    expect(colMatches?.length).toBe(3);
  });

  it("renders icon + name + desc + meta per column", () => {
    const html = renderToStaticMarkup(
      <P2
        page={makeP2Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain('data-cn-role="p2-col-icon"');
    expect(html).toContain('data-cn-role="p2-col-name"');
    expect(html).toContain('data-cn-role="p2-col-desc"');
    expect(html).toContain('data-cn-role="p2-col-meta"');
    expect(html).toContain("SKILL.md 한 장이면 끝"); // meta text
  });

  it("does not crash when list is empty (pads with blank cols)", () => {
    const page = makeP2Page();
    const empty = { ...page, copy: { ...page.copy, list: [] } };
    const html = renderToStaticMarkup(
      <P2
        page={empty}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    const colMatches = html.match(/data-cn-role="p2-col"/g);
    expect(colMatches?.length).toBe(3);
  });
});
