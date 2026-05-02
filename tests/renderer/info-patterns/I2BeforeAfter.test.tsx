import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I2BeforeAfter } from "../../../src/renderer/info-patterns/I2BeforeAfter";

describe("I2BeforeAfter info pattern", () => {
  it("renders before/after columns and meaning sentence", () => {
    const html = renderToStaticMarkup(
      <I2BeforeAfter
        texts={{
          primary: "수동으로 5단계 거쳐 배포",
          secondary: "PR 머지 → 자동 배포",
          tertiary: "릴리즈 사이클이 1일에서 1시간으로.",
        }}
      />
    );
    expect(html).toContain('data-cn-role="i2-before-after"');
    expect(html).toContain('data-cn-role="i2-before"');
    expect(html).toContain('data-cn-role="i2-after"');
    expect(html).toContain("수동으로 5단계");
    expect(html).toContain("PR 머지");
    expect(html).toContain("릴리즈 사이클");
    expect(html).toContain("Before");
    expect(html).toContain("After");
  });
});
