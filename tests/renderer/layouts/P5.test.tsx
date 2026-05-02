import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P5 from "../../../src/renderer/layouts/P5";
import { makePreset, makeSeries, makeP5Page } from "../_fixtures";

describe("P5 layout", () => {
  it("renders title + formula highlight + 2 prompt cards", () => {
    const html = renderToStaticMarkup(
      <P5
        page={makeP5Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("프롬프트 한 줄 공식");
    expect(html).toContain("역할 + 맥락 + 작업 + 제약");
    expect(html).toContain("기본형");
    expect(html).toContain("확장형");
    const cards = html.match(/data-cn-role="p5-card"/g);
    expect(cards?.length).toBe(2);
  });

  it("does not crash without highlight or list", () => {
    const page = makeP5Page();
    const bare = {
      ...page,
      copy: { ...page.copy, highlight: undefined, list: undefined },
    };
    const html = renderToStaticMarkup(
      <P5
        page={bare}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).not.toContain('data-cn-role="p5-formula"');
    // 2 empty cards still rendered (padded)
    const cards = html.match(/data-cn-role="p5-card"/g);
    expect(cards?.length).toBe(2);
  });
});
