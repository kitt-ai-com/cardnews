import { describe, expect, it } from "vitest";
import { ClaimSchema } from "@core/schemas/claim";

describe("Claim", () => {
  it("accepts a valid fact claim", () => {
    const ok = ClaimSchema.parse({
      id: "C1",
      text: "Claude 4.7 supports 1M token context",
      type: "fact",
      confidence: "high",
    });
    expect(ok.risk).toBe("none");
    expect(ok.scope).toEqual([]);
  });

  it("rejects type=number without evidence and without sourceRef", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C2",
        text: "92% accuracy",
        type: "number",
        confidence: "high",
      })
    ).toThrow(/evidence or sourceRef/i);
  });

  it("accepts type=number with evidence", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C3",
        text: "92% accuracy",
        type: "number",
        confidence: "high",
        evidence: "Reported in Anthropic blog post 2026-04",
      })
    ).not.toThrow();
  });

  it("accepts type=number with sourceRef only", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C4",
        text: "92% accuracy",
        type: "number",
        confidence: "high",
        sourceRef: "https://anthropic.com/news/x",
      })
    ).not.toThrow();
  });

  it("rejects risk=outdated without asOf", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C5",
        text: "Sonnet 3.5 is the newest model",
        type: "fact",
        confidence: "medium",
        risk: "outdated",
      })
    ).toThrow(/asOf/i);
  });

  it("accepts risk=outdated with asOf", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C6",
        text: "Sonnet 3.5 is the newest model",
        type: "fact",
        confidence: "medium",
        risk: "outdated",
        asOf: "2024-10-01",
      })
    ).not.toThrow();
  });

  it("rejects unknown type", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C7",
        text: "x",
        type: "rumor",
        confidence: "low",
      })
    ).toThrow();
  });

  it("rejects unknown confidence", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C8",
        text: "x",
        type: "fact",
        confidence: "maybe",
      })
    ).toThrow();
  });

  it("rejects unknown risk", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "C9",
        text: "x",
        type: "fact",
        confidence: "high",
        risk: "shrug",
      })
    ).toThrow();
  });
});
