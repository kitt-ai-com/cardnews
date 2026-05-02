import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Cta from "../../../src/renderer/layouts/cta";
import { makePreset, makeSeries, makeCtaPage } from "../_fixtures";

describe("Cta layout", () => {
  it("renders bg image, label, title, body", () => {
    const html = renderToStaticMarkup(
      <Cta
        page={makeCtaPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/cta.png"
      />
    );
    expect(html).toContain("/cta.png");
    expect(html).toContain("지금 시작");
    expect(html).toContain("오늘은");
    expect(html).toContain("스킬 하나 만들거나");
  });

  it("renders footer with handle + page index", () => {
    const html = renderToStaticMarkup(
      <Cta
        page={makeCtaPage()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
    expect(html).toContain("08 / 08");
  });

  it("does not crash when body is absent", () => {
    const page = makeCtaPage();
    const noBody = { ...page, copy: { ...page.copy, body: undefined } };
    const html = renderToStaticMarkup(
      <Cta
        page={noBody}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain('data-cn-role="cta-title"');
    expect(html).not.toContain('data-cn-role="cta-body"');
  });
});
