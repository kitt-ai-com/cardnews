import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I3Mechanism } from "../../../src/renderer/info-patterns/I3Mechanism";

describe("I3Mechanism info pattern", () => {
  it("renders three stages connected by arrows", () => {
    const html = renderToStaticMarkup(
      <I3Mechanism
        texts={{
          primary: "프롬프트가 길고 복잡하다",
          secondary: "Claude가 핵심 의도를 못 잡는다",
          tertiary: "결과 품질이 들쑥날쑥",
        }}
      />
    );
    expect(html).toContain('data-cn-role="i3-mechanism"');
    expect(html).toContain("프롬프트가");
    expect(html).toContain("핵심 의도를");
    expect(html).toContain("들쑥날쑥");
    // arrows between stages
    expect(html).toContain("↓");
    expect(html).toContain("원인");
    expect(html).toContain("작동");
    expect(html).toContain("결과");
  });
});
