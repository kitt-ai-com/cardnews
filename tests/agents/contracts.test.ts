import { describe, it, expect } from "vitest";
import {
  AnalystInputSchema,
  AnalystOutputSchema,
} from "../../src/core/agents/contracts/analyst";
import {
  CopywriterPageInputSchema,
  CopywriterPageOutputSchema,
} from "../../src/core/agents/contracts/copywriter";
import { ImageDirectorOutputSchema } from "../../src/core/agents/contracts/image-director";
import { FactCheckerOutputSchema } from "../../src/core/agents/contracts/fact-checker";

// Reusable v2 Analyst output. Test cases clone-and-tweak this.
function validAnalystOutput() {
  return {
    thesis: "한 문장으로 카드뉴스가 옹호하는 핵심 주장.",
    audienceQuestion: "이걸 어떻게 시작하지?",
    narrativeArc: {
      hook: "주의를 끄는 한 줄.",
      context: "지금 왜 이 주제인가.",
      mechanism: "어떻게 작동하는가.",
      evidence: "근거 1~2개.",
      implication: "독자에게 무엇을 의미하는가.",
      action: "다음 행동.",
    },
    claimLedger: {
      claims: [
        {
          id: "c1",
          text: "핵심 사실.",
          type: "fact",
          confidence: "high",
          risk: "none",
        },
        {
          id: "c2",
          text: "보조 사실.",
          type: "fact",
          confidence: "medium",
          risk: "none",
        },
      ],
      sourceDigest: {
        sources: [],
        audienceQuestion: "이걸 어떻게 시작하지?",
      },
    },
    coreMessage: "한 문장 핵심.",
    hookStrategy: "통감되는 문제로 시작.",
    flow: "cover → P1 → P2 → cta",
    pages: [
      {
        index: 1,
        role: "cover",
        layout: "cover",
        workingTitle: "Hook title",
        message: "Why this matters",
        mappingNote: "Lead with the pain",
        copyIntent: "hook",
        claims: ["c1"],
      },
      {
        index: 2,
        role: "body",
        layout: "P1",
        workingTitle: "Body 1",
        message: "First insight",
        mappingNote: "Explain the cause",
        copyIntent: "definition",
        claims: ["c1"],
      },
      {
        index: 3,
        role: "body",
        layout: "P2",
        workingTitle: "Body 2",
        message: "Second insight",
        mappingNote: "Show the contrast",
        copyIntent: "comparison",
        claims: ["c2"],
      },
      {
        index: 4,
        role: "cta",
        layout: "cta",
        workingTitle: "CTA",
        message: "Take action",
        mappingNote: "Direct ask",
        copyIntent: "cta",
        claims: ["c2"],
      },
    ],
  };
}

describe("Analyst contract", () => {
  it("rejects empty input and output", () => {
    expect(() => AnalystInputSchema.parse({})).toThrow();
    expect(() => AnalystOutputSchema.parse({})).toThrow();
  });

  it("accepts a valid v2 output (cover/2 body/cta with ledger refs)", () => {
    expect(() => AnalystOutputSchema.parse(validAnalystOutput())).not.toThrow();
  });

  it("rejects output missing thesis", () => {
    const out = validAnalystOutput();
    delete (out as Record<string, unknown>).thesis;
    expect(() => AnalystOutputSchema.parse(out)).toThrow();
  });

  it("rejects output missing claimLedger", () => {
    const out = validAnalystOutput();
    delete (out as Record<string, unknown>).claimLedger;
    expect(() => AnalystOutputSchema.parse(out)).toThrow();
  });

  it("rejects a page that references an unknown ledger claim id", () => {
    const out = validAnalystOutput();
    out.pages[1].claims = ["nonexistent"];
    expect(() => AnalystOutputSchema.parse(out)).toThrow(
      /unknown claim id/,
    );
  });

  it("rejects when first page is not cover", () => {
    const out = validAnalystOutput();
    out.pages[0].role = "body";
    expect(() => AnalystOutputSchema.parse(out)).toThrow();
  });
});

describe("Copywriter contract", () => {
  it("accepts page.copyIntent on input and validates the enum", () => {
    function buildPage(intent: unknown) {
      return {
        series: {
          name: "s",
          audience: "a",
          tone: "t",
          branding: { seriesTag: "#s" },
        },
        outline: {},
        page: {
          index: 2,
          role: "body",
          layout: "P1",
          workingTitle: "wt",
          message: "m",
          mappingNote: "mn",
          copyIntent: intent,
        },
        copyContext: {
          tone: "info",
          recurringTerms: [],
          usedExamples: [],
          forbiddenRepeats: [],
          committedClaims: [],
          pendingClaims: [],
        },
      };
    }
    // valid enum value passes
    expect(() =>
      CopywriterPageInputSchema.parse(buildPage("evidence")),
    ).not.toThrow();
    // invalid enum value rejected
    expect(() =>
      CopywriterPageInputSchema.parse(buildPage("not-an-intent")),
    ).toThrow();
  });

  it("accepts ledgerSlice and page.claims on input", () => {
    const input = {
      series: {
        name: "s",
        audience: "a",
        tone: "t",
        branding: { seriesTag: "#s" },
      },
      outline: {},
      page: {
        index: 2,
        role: "body",
        layout: "P1",
        workingTitle: "wt",
        message: "m",
        mappingNote: "mn",
        copyIntent: "evidence",
        claims: ["c1"],
      },
      ledgerSlice: [
        {
          id: "c1",
          text: "fact",
          type: "fact",
          confidence: "high",
          risk: "none",
        },
      ],
      copyContext: {
        tone: "info",
        recurringTerms: [],
        usedExamples: [],
        forbiddenRepeats: [],
        committedClaims: [],
        pendingClaims: [],
      },
    };
    expect(() => CopywriterPageInputSchema.parse(input)).not.toThrow();
  });

  it("rejects empty title and accepts valid output with committedClaimIds", () => {
    expect(() =>
      CopywriterPageOutputSchema.parse({ copy: { title: "" } }),
    ).toThrow();
    expect(() =>
      CopywriterPageOutputSchema.parse({
        copy: { title: "Hello" },
        committedClaimIds: ["c1"],
      }),
    ).not.toThrow();
  });
});

describe("ImageDirector contract", () => {
  it("accepts a minimal valid prompt", () => {
    expect(() =>
      ImageDirectorOutputSchema.parse({
        prompt: { text: "abstract", size: "1024x1536" },
      }),
    ).not.toThrow();
  });
});

describe("FactChecker contract", () => {
  it("rejects invalid status enum", () => {
    expect(() =>
      FactCheckerOutputSchema.parse({
        claims: [
          { claim: "x", status: "bogus", reason: "r" },
        ],
      }),
    ).toThrow();
  });

  it("accepts a confirmed claim", () => {
    expect(() =>
      FactCheckerOutputSchema.parse({
        claims: [
          { claim: "Earth orbits the Sun", status: "confirmed", reason: "Well-established" },
        ],
      }),
    ).not.toThrow();
  });
});
