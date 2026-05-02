import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P3 from "../../../src/renderer/layouts/P3";
import { makePreset, makeSeries, makeP3Page } from "../_fixtures";

describe("P3 layout", () => {
  it("renders label + title + checklist items", () => {
    const html = renderToStaticMarkup(
      <P3
        page={makeP3Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("이렇게 쓴다");
    expect(html).toContain("자주 쓰는");
    expect(html).toContain("/simplify");
    expect(html).toContain("/loop");
  });

  it("renders one checklist-item per list entry with check marks", () => {
    const html = renderToStaticMarkup(
      <P3
        page={makeP3Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    const items = html.match(/data-cn-role="checklist-item"/g);
    expect(items?.length).toBe(4);
    const marks = html.match(/data-cn-role="check-mark"/g);
    expect(marks?.length).toBe(4);
  });

  it("renders inline markup (<b>, <code>) inside list items", () => {
    const html = renderToStaticMarkup(
      <P3
        page={makeP3Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    // <b>/review</b> -> accent span
    expect(html).toContain("/review");
    expect(html).toContain("var(--color-accent)");
  });

  it("does not crash when list is missing", () => {
    const page = makeP3Page();
    const empty = { ...page, copy: { ...page.copy, list: undefined } };
    const html = renderToStaticMarkup(
      <P3
        page={empty}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain('data-cn-role="checklist"');
    expect(html).not.toContain('data-cn-role="checklist-item"');
  });
});
