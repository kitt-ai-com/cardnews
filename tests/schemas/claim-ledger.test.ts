import { describe, expect, it } from "vitest";
import { ClaimLedgerSchema } from "@core/schemas/claim-ledger";

const claimA = {
  id: "C1",
  text: "Claude 4.7 supports 1M token context",
  type: "fact" as const,
  confidence: "high" as const,
};
const claimB = {
  id: "C2",
  text: "Bigger context lets you load whole repos",
  type: "interpretation" as const,
  confidence: "medium" as const,
};

describe("ClaimLedger", () => {
  it("accepts a valid ledger with 2 claims + sourceDigest", () => {
    const ok = ClaimLedgerSchema.parse({
      claims: [claimA, claimB],
      sourceDigest: {
        sources: [
          {
            ref: "https://anthropic.com/news/x",
            kind: "press-release",
            trustLevel: "primary",
            retrievedAt: "2026-05-01T00:00:00.000Z",
          },
        ],
        audienceQuestion: "왜 1M 컨텍스트가 의미 있나?",
      },
    });
    expect(ok.claims).toHaveLength(2);
    expect(ok.sourceDigest.sources).toHaveLength(1);
  });

  it("defaults sources to [] when omitted", () => {
    const ok = ClaimLedgerSchema.parse({
      claims: [claimA],
      sourceDigest: { audienceQuestion: "Q?" },
    });
    expect(ok.sourceDigest.sources).toEqual([]);
  });

  it("rejects empty claims array", () => {
    expect(() =>
      ClaimLedgerSchema.parse({
        claims: [],
        sourceDigest: { audienceQuestion: "Q?" },
      })
    ).toThrow();
  });

  it("rejects duplicate claim id", () => {
    expect(() =>
      ClaimLedgerSchema.parse({
        claims: [claimA, { ...claimB, id: "C1" }],
        sourceDigest: { audienceQuestion: "Q?" },
      })
    ).toThrow(/duplicate claim id/i);
  });

  it("rejects missing audienceQuestion", () => {
    expect(() =>
      ClaimLedgerSchema.parse({
        claims: [claimA],
        sourceDigest: { sources: [] },
      })
    ).toThrow();
  });

  it("rejects empty audienceQuestion", () => {
    expect(() =>
      ClaimLedgerSchema.parse({
        claims: [claimA],
        sourceDigest: { audienceQuestion: "" },
      })
    ).toThrow();
  });
});
