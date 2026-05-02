import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import P1 from "../../../src/renderer/layouts/P1";
import {
  makePreset,
  makeSeries,
  makeP1Page,
  makeP1PageWithList,
} from "../_fixtures";

describe("P1 layout", () => {
  it("renders top image + body copy with renderInline (code chip)", () => {
    const html = renderToStaticMarkup(
      <P1
        page={makeP1Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/p1.png"
      />
    );
    expect(html).toContain("/p1.png");
    expect(html).toContain('data-cn-role="p1-image"');
    expect(html).toContain("SKILL.md"); // title text
    expect(html).toContain("프로젝트 또는"); // body
    // <code>SKILL.md</code> in body should be rendered as code chip
    expect(html).toContain("background-color:var(--color-accent)");
  });

  it("renders gradient fade overlay over the image", () => {
    const html = renderToStaticMarkup(
      <P1
        page={makeP1Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
        imageSrc="/p1.png"
      />
    );
    expect(html).toContain('data-cn-role="p1-image-fade"');
    expect(html).toContain("linear-gradient");
  });

  it("falls back to a bullet list when body is absent but list is present", () => {
    const html = renderToStaticMarkup(
      <P1
        page={makeP1PageWithList()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain('data-cn-role="bullet-list"');
    expect(html).toContain("frontmatter description");
  });

  it("renders footer", () => {
    const html = renderToStaticMarkup(
      <P1
        page={makeP1Page()}
        preset={makePreset()}
        series={makeSeries()}
        totalPages={8}
      />
    );
    expect(html).toContain("@uhuru_nomadlife");
    expect(html).toContain("03 / 08");
  });
});
