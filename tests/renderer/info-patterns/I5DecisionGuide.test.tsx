import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I5DecisionGuide } from "../../../src/renderer/info-patterns/I5DecisionGuide";

describe("I5DecisionGuide info pattern", () => {
  it("renders ✓ / ✗ lists and a recommended-action pill", () => {
    const html = renderToStaticMarkup(
      <I5DecisionGuide
        whenToUse={["반복 작업이 매일 발생", "단계가 명확함"]}
        whenNotToUse={["일회성 탐색", "정의가 흐릿"]}
        texts={{ tertiary: "오늘 한 번이라도 반복했다면 자동화하라" }}
      />
    );
    expect(html).toContain('data-cn-role="i5-decision-guide"');
    expect(html).toContain("✓");
    expect(html).toContain("✗");
    expect(html).toContain("반복 작업이 매일 발생");
    expect(html).toContain("일회성 탐색");
    expect(html).toContain('data-cn-role="i5-action"');
    expect(html).toContain("자동화하라");
  });

  it("falls back to splitting texts.primary / texts.secondary by lines", () => {
    const html = renderToStaticMarkup(
      <I5DecisionGuide
        texts={{ primary: "케이스A\n케이스B", secondary: "안케이스1" }}
      />
    );
    expect(html).toContain("케이스A");
    expect(html).toContain("케이스B");
    expect(html).toContain("안케이스1");
  });
});
