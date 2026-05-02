import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I1ClaimEvidence } from "../../../src/renderer/info-patterns/I1ClaimEvidence";
import type { Claim } from "../../../src/core/schemas/claim";

describe("I1ClaimEvidence info pattern", () => {
  it("renders headline, evidence chips, and annotation from claims", () => {
    const claims: Claim[] = [
      {
        id: "c1",
        text: "코드 한 줄 변경으로 빌드 시간을 절반으로 줄였다.",
        type: "fact",
        evidence: "12s → 6s",
        confidence: "high",
        sourceRef: "internal-bench",
        risk: "none",
        scope: [],
      },
      {
        id: "c2",
        text: "supporting",
        type: "fact",
        evidence: "10k samples",
        confidence: "high",
        risk: "none",
        scope: [],
      },
    ];
    const html = renderToStaticMarkup(<I1ClaimEvidence claims={claims} />);
    expect(html).toContain('data-cn-role="i1-claim-evidence"');
    expect(html).toContain("빌드 시간을 절반으로");
    expect(html).toContain("12s → 6s");
    expect(html).toContain("10k samples");
    expect(html).toContain("internal-bench");
  });

  it("falls back to texts.primary when claims absent", () => {
    const html = renderToStaticMarkup(
      <I1ClaimEvidence texts={{ primary: "단일 주장 카피" }} />
    );
    expect(html).toContain("단일 주장 카피");
    expect(html).toContain('data-cn-role="i1-headline"');
  });
});
