import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P7 from "../../../src/renderer/layouts/P7";
import { makePreset, makeSeries, makeP7Page } from "../_fixtures";

describe("P7 layout", () => {
  it("renders label + title + decorative shape", () => {
    const html = renderToStaticMarkup(
      <P7
        page={makeP7Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("한 줄 요약");
    expect(html).toContain("결국, 한 줄이면 충분하다");
    expect(html).toContain('data-cn-role="p7-decoration"');
  });

  it("renders footer", () => {
    const html = renderToStaticMarkup(
      <P7
        page={makeP7Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
    expect(html).toContain("07 / 08");
  });
});
