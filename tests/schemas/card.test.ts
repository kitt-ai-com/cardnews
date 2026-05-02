import { describe, expect, it } from "vitest";
import { CardSchema } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";

function makePage(
  index: number,
  role: "cover" | "body" | "cta",
  layout: "cover" | "cta" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7"
): Page {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote: `n${index}`,
    copy: { title: `T${index}` },
    manualEdit: false,
  };
}

const baseCard = {
  id: "2026-05-01-test",
  series: "claude",
  preset: "c1-dark-lime",
  topic: "test",
  sourcePolicy: { trustLevel: "unknown", factCheckMode: "strict" },
  coreMessage: "core",
  pages: [
    makePage(1, "cover", "cover"),
    makePage(2, "body", "P1"),
    makePage(3, "body", "P2"),
    makePage(4, "cta", "cta"),
  ],
  status: "draft.outline-ready",
  attempts: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("Card", () => {
  it("accepts a valid card", () => {
    expect(() => CardSchema.parse(baseCard)).not.toThrow();
  });

  it("rejects when first page is not 'cover'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[0].role = "body";
    expect(() => CardSchema.parse(bad)).toThrow(/first page.*cover/i);
  });

  it("rejects when last page is not 'cta'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[bad.pages.length - 1].role = "body";
    expect(() => CardSchema.parse(bad)).toThrow(/last page.*cta/i);
  });

  it("rejects middle page that isn't 'body'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[1].role = "cover";
    // also rebalance to keep the cover/cta roles intact otherwise this would
    // also trip the first/last refines, depending on order
    expect(() => CardSchema.parse(bad)).toThrow(/middle pages.*body/i);
  });

  it("rejects when only one body layout type used", () => {
    const bad = structuredClone(baseCard);
    bad.pages[2].layout = "P1"; // both body pages are P1
    expect(() => CardSchema.parse(bad)).toThrow(/at least 2.*body layouts/i);
  });

  it("rejects pages array of length < 3", () => {
    const bad = structuredClone(baseCard);
    bad.pages = [makePage(1, "cover", "cover"), makePage(2, "cta", "cta")];
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("attempts defaults to []", () => {
    const { attempts: _omit, ...rest } = baseCard;
    const out = CardSchema.parse(rest);
    expect(out.attempts).toEqual([]);
  });

  it("rejects unknown status", () => {
    const bad = structuredClone(baseCard);
    (bad as unknown as { status: string }).status = "paused-for-approval";
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("rejects unknown failedStage", () => {
    const bad = structuredClone(baseCard);
    (bad as unknown as { failedStage: string }).failedStage = "wat";
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("accepts a valid failedStage enum", () => {
    const ok = structuredClone(baseCard);
    (ok as unknown as { failedStage: string }).failedStage = "copywriter";
    expect(() => CardSchema.parse(ok)).not.toThrow();
  });

  it("accepts a card with 5 pages and ≥2 body layouts", () => {
    const ok = structuredClone(baseCard);
    ok.pages = [
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "body", "P3"),
      makePage(5, "cta", "cta"),
    ];
    expect(() => CardSchema.parse(ok)).not.toThrow();
  });

  it("pipelineVersion defaults to 'v1-mocked' when omitted", () => {
    const out = CardSchema.parse(baseCard);
    expect(out.pipelineVersion).toBe("v1-mocked");
  });

  it("accepts pipelineVersion = 'v2-editorial' enum value (refine handled in v2 suite)", () => {
    // pipelineVersion enum itself accepts 'v2-editorial'; the conditional
    // refine that requires thesis/audienceQuestion/narrativeArc/claimLedger
    // is exercised in the "Card v2-editorial conditional refine" suite below.
    expect(() =>
      CardSchema.parse({ ...baseCard, pipelineVersion: "v2-editorial" })
    ).toThrow(/v2-editorial requires/i);
  });

  it("rejects unknown pipelineVersion", () => {
    const bad = { ...baseCard, pipelineVersion: "v3-magic" };
    expect(() => CardSchema.parse(bad)).toThrow();
  });
});

describe("Card v2-editorial conditional refine", () => {
  const validClaim = {
    id: "C1",
    text: "claim text",
    type: "fact" as const,
    confidence: "high" as const,
  };
  const validClaim2 = {
    id: "C2",
    text: "claim text 2",
    type: "interpretation" as const,
    confidence: "medium" as const,
  };
  const validArc = {
    hook: "h",
    context: "c",
    mechanism: "m",
    evidence: "e",
    implication: "i",
    action: "a",
  };
  const validLedger = {
    claims: [validClaim, validClaim2],
    sourceDigest: { audienceQuestion: "Q?" },
  };

  function v2Page(
    index: number,
    role: "cover" | "body" | "cta",
    layout: "cover" | "cta" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7",
    copyIntent: string,
    claims: string[] = []
  ) {
    return {
      index,
      role,
      layout,
      copyIntent,
      message: `m${index}`,
      mappingNote: `n${index}`,
      claims,
      copy: { title: `T${index}` },
      manualEdit: false,
    };
  }

  const v2Card = {
    id: "2026-05-02-v2-test",
    series: "claude",
    preset: "c1-dark-lime",
    pipelineVersion: "v2-editorial",
    topic: "test",
    sourcePolicy: { trustLevel: "primary", factCheckMode: "strict" },
    coreMessage: "core",
    thesis: "thesis sentence",
    audienceQuestion: "Q?",
    narrativeArc: validArc,
    claimLedger: validLedger,
    pages: [
      v2Page(1, "cover", "cover", "hook", ["C1"]),
      v2Page(2, "body", "P1", "evidence", ["C1"]),
      v2Page(3, "body", "P2", "mechanism", ["C2"]),
      v2Page(4, "cta", "cta", "cta", []),
    ],
    status: "draft.outline-ready",
    attempts: [],
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };

  it("accepts a complete v2-editorial card", () => {
    expect(() => CardSchema.parse(v2Card)).not.toThrow();
  });

  it("v1 cards without v2 fields still parse (regression)", () => {
    expect(() => CardSchema.parse(baseCard)).not.toThrow();
  });

  it("rejects v2 card without thesis", () => {
    const bad = structuredClone(v2Card);
    delete (bad as Record<string, unknown>).thesis;
    expect(() => CardSchema.parse(bad)).toThrow(/thesis/i);
  });

  it("rejects v2 card without audienceQuestion", () => {
    const bad = structuredClone(v2Card);
    delete (bad as Record<string, unknown>).audienceQuestion;
    expect(() => CardSchema.parse(bad)).toThrow(/audienceQuestion/i);
  });

  it("rejects v2 card without narrativeArc", () => {
    const bad = structuredClone(v2Card);
    delete (bad as Record<string, unknown>).narrativeArc;
    expect(() => CardSchema.parse(bad)).toThrow(/narrativeArc/i);
  });

  it("rejects v2 card without claimLedger", () => {
    const bad = structuredClone(v2Card);
    delete (bad as Record<string, unknown>).claimLedger;
    expect(() => CardSchema.parse(bad)).toThrow(/claimLedger/i);
  });

  it("rejects v2 card with page.claims referencing missing ledger id", () => {
    const bad = structuredClone(v2Card);
    bad.pages[1].claims = ["C99"];
    expect(() => CardSchema.parse(bad)).toThrow(/unknown claim id: C99/i);
  });

  it("rejects v2 card with a page missing copyIntent", () => {
    const bad = structuredClone(v2Card);
    delete (bad.pages[2] as Record<string, unknown>).copyIntent;
    expect(() => CardSchema.parse(bad)).toThrow(/copyIntent/i);
  });
});
