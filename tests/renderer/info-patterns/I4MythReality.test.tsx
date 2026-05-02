import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I4MythReality } from "../../../src/renderer/info-patterns/I4MythReality";

describe("I4MythReality info pattern", () => {
  it("renders myth (line-through) and reality columns + caveat", () => {
    const html = renderToStaticMarkup(
      <I4MythReality
        texts={{
          primary: "AI가 다 짜준다",
          secondary: "AI는 코드 작성을 가속할 뿐, 설계 책임은 사람",
          tertiary: "복잡한 도메인에서는 사람의 검수가 더 중요해진다.",
        }}
      />
    );
    expect(html).toContain('data-cn-role="i4-myth-reality"');
    expect(html).toContain('data-cn-role="i4-myth"');
    expect(html).toContain('data-cn-role="i4-reality"');
    expect(html).toContain("AI가 다 짜준다");
    expect(html).toContain("코드 작성을 가속");
    expect(html).toContain("line-through"); // myth styled with strikethrough
    expect(html).toContain("흔한 오해");
    expect(html).toContain("실제는");
    expect(html).toContain("복잡한 도메인");
  });
});
