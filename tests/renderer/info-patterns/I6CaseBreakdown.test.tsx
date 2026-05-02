import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I6CaseBreakdown } from "../../../src/renderer/info-patterns/I6CaseBreakdown";

describe("I6CaseBreakdown info pattern", () => {
  it("renders case + why-it-matters + lesson sections", () => {
    const html = renderToStaticMarkup(
      <I6CaseBreakdown
        caseTitle="A사가 PR 리뷰를 자동화한 이야기"
        caseDescription="레거시 코드 리뷰 누적이 문제였다."
        whyItMatters="리뷰가 밀리면 머지가 밀리고 배포가 늦어진다."
        lesson="자동화 한 단계만 더 들어가면 사이클이 짧아진다."
      />
    );
    expect(html).toContain('data-cn-role="i6-case-breakdown"');
    expect(html).toContain("CASE");
    expect(html).toContain("WHY IT MATTERS");
    expect(html).toContain("PR 리뷰를 자동화");
    expect(html).toContain("레거시 코드 리뷰");
    expect(html).toContain("자동화 한 단계만");
    expect(html).toContain('data-cn-role="i6-lesson"');
  });

  it("uses texts.primary/secondary/tertiary as fallback", () => {
    const html = renderToStaticMarkup(
      <I6CaseBreakdown
        texts={{
          primary: "TitleX",
          secondary: "WhyX",
          tertiary: "LessonX",
        }}
      />
    );
    expect(html).toContain("TitleX");
    expect(html).toContain("WhyX");
    expect(html).toContain("LessonX");
  });
});
