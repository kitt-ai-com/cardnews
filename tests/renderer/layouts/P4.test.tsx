import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P4 from "../../../src/renderer/layouts/P4";
import { makePreset, makeSeries, makeP4Page } from "../_fixtures";

describe("P4 layout", () => {
  it("renders label, title, subtitle and a SAVE FOR LATER badge", () => {
    const html = renderToStaticMarkup(
      <P4
        page={makeP4Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("보관용");
    expect(html).toContain("이건 나중에");
    expect(html).toContain("스킬 정리");
    expect(html).toContain("SAVE FOR LATER");
    expect(html).toContain('data-cn-role="p4-badge"');
  });

  it("renders without subtitle gracefully", () => {
    const page = makeP4Page();
    const noSub = { ...page, copy: { ...page.copy, subtitle: undefined } };
    const html = renderToStaticMarkup(
      <P4
        page={noSub}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).not.toContain('data-cn-role="p4-subtitle"');
    expect(html).toContain('data-cn-role="p4-title"');
  });

  it("renders footer", () => {
    const html = renderToStaticMarkup(
      <P4
        page={makeP4Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
  });
});
