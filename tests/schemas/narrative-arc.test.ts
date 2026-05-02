import { describe, expect, it } from "vitest";
import { NarrativeArcSchema } from "@core/schemas/narrative-arc";

const validArc = {
  hook: "왜 1M 컨텍스트인가?",
  context: "기존 200K로 쪼개야 했던 작업",
  mechanism: "단일 호출에 전체 코드 로드",
  evidence: "Anthropic 발표 (2026-05)",
  implication: "리팩토링 워크플로 변화",
  action: "큰 리포에서 한 번 시도",
};

describe("NarrativeArc", () => {
  it("accepts a valid 6-section arc", () => {
    expect(() => NarrativeArcSchema.parse(validArc)).not.toThrow();
  });

  for (const k of [
    "hook",
    "context",
    "mechanism",
    "evidence",
    "implication",
    "action",
  ] as const) {
    it(`rejects when ${k} is missing`, () => {
      const bad = { ...validArc };
      delete (bad as Record<string, unknown>)[k];
      expect(() => NarrativeArcSchema.parse(bad)).toThrow();
    });
    it(`rejects when ${k} is empty string`, () => {
      const bad = { ...validArc, [k]: "" };
      expect(() => NarrativeArcSchema.parse(bad)).toThrow();
    });
  }
});
