import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P6 from "../../../src/renderer/layouts/P6";
import { makePreset, makeSeries, makeP6Page } from "../_fixtures";

describe("P6 layout", () => {
  it("renders bg + title + body + lime pill button using highlight text", () => {
    const html = renderToStaticMarkup(
      <P6
        page={makeP6Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/p6.png"
      />
    );
    expect(html).toContain("/p6.png");
    expect(html).toContain("오늘은");
    expect(html).toContain("스킬 하나");
    expect(html).toContain("저장하고 따라하기");
    expect(html).toContain('data-cn-role="p6-button"');
  });

  it("uses default button text when highlight is absent", () => {
    const page = makeP6Page();
    const noHi = { ...page, copy: { ...page.copy, highlight: undefined } };
    const html = renderToStaticMarkup(
      <P6
        page={noHi}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("시작하기");
  });

  it("renders footer", () => {
    const html = renderToStaticMarkup(
      <P6
        page={makeP6Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
    expect(html).toContain("08 / 08");
  });
});
