import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Cover from "../../../src/renderer/layouts/cover";
import { makePreset, makeSeries, makeCoverPage } from "../_fixtures";

describe("Cover layout", () => {
  it("renders with full background image", () => {
    const html = renderToStaticMarkup(
      <Cover
        page={makeCoverPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/test.png"
      />
    );
    expect(html).toContain("/test.png");
    expect(html).toContain('data-cn-role="cover-bg"');
  });

  it("renders label, title, subtitle from page.copy", () => {
    const html = renderToStaticMarkup(
      <Cover
        page={makeCoverPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/x.png"
      />
    );
    expect(html).toContain("CLAUDE CODE"); // label
    expect(html).toContain("스킬·훅·루프"); // title prefix
    expect(html).toContain("자주 쓰는 일은 명령으로"); // subtitle prefix
  });

  it("renders footer with handle and zero-padded page index", () => {
    const html = renderToStaticMarkup(
      <Cover
        page={makeCoverPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/x.png"
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
    expect(html).toContain("01 / 08");
  });

  it("falls back to bg color placeholder when imageSrc is missing", () => {
    const html = renderToStaticMarkup(
      <Cover
        page={makeCoverPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    // No background-image url, but cover-bg div still present
    expect(html).toContain('data-cn-role="cover-bg"');
    expect(html).not.toContain("background-image:url(");
  });
});
