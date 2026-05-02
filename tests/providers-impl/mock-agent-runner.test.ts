import { describe, expect, it } from "vitest";
import {
  makeMockAnalyst,
  makeMockCopywriter,
  makeMockImageDirector,
  makeMockFactChecker,
} from "@impl/mock-agent-runner";
import {
  AnalystOutputSchema,
  type AnalystInput,
} from "@core/agents/contracts/analyst";
import type { CopywriterPageInput } from "@core/agents/contracts/copywriter";
import type { ImageDirectorInput } from "@core/agents/contracts/image-director";
import type { FactCheckerInput } from "@core/agents/contracts/fact-checker";

const baseSeries = {
  id: "claude",
  name: "Claude Series",
  theme: "ai",
  audience: "devs",
  tone: "informative",
  branding: { seriesTag: "#claude" },
  footerHandle: "@claude",
};

const basePreset = {
  id: "c1-dark-lime",
  layouts: ["cover", "cta", "P1", "P2", "P3", "P4", "P5"] as const,
};

const baseSourcePolicy = { trustLevel: "unknown", factCheckMode: "strict" } as const;

function analystInput(overrides: Partial<AnalystInput> = {}): AnalystInput {
  return {
    series: baseSeries,
    preset: { id: basePreset.id, layouts: [...basePreset.layouts] },
    topic: "AI 트렌드",
    sourcePolicy: baseSourcePolicy,
    ...overrides,
  } as AnalystInput;
}

describe("makeMockAnalyst", () => {
  it("returns valid output: first=cover, last=cta, ≥2 distinct body layouts", async () => {
    const analyst = makeMockAnalyst();
    const out = await analyst.run(analystInput());

    expect(out.pages.length).toBeGreaterThanOrEqual(4);
    expect(out.pages[0].role).toBe("cover");
    expect(out.pages[out.pages.length - 1].role).toBe("cta");

    const bodyLayouts = out.pages
      .filter((p) => p.role === "body")
      .map((p) => p.layout);
    const unique = new Set(bodyLayouts);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("longer source text => more pages", async () => {
    const analyst = makeMockAnalyst();
    const small = await analyst.run(
      analystInput({ sourceText: "x".repeat(100), topic: undefined })
    );
    const large = await analyst.run(
      analystInput({ sourceText: "x".repeat(2000), topic: undefined })
    );
    expect(large.pages.length).toBeGreaterThan(small.pages.length);
  });

  it("output passes the full v2 AnalystOutputSchema (incl. ref integrity)", async () => {
    const analyst = makeMockAnalyst();
    const out = await analyst.run(analystInput());
    // The runner already parses internally, but re-parse here to assert the
    // shape is stable against the exported schema.
    expect(() => AnalystOutputSchema.parse(out)).not.toThrow();
  });

  it("emits a Claim Ledger with ≥3 claims and a complete narrative arc", async () => {
    const analyst = makeMockAnalyst();
    const out = await analyst.run(analystInput());
    expect(out.claimLedger.claims.length).toBeGreaterThanOrEqual(3);
    expect(out.narrativeArc.hook).toBeTruthy();
    expect(out.narrativeArc.context).toBeTruthy();
    expect(out.narrativeArc.mechanism).toBeTruthy();
    expect(out.narrativeArc.evidence).toBeTruthy();
    expect(out.narrativeArc.implication).toBeTruthy();
    expect(out.narrativeArc.action).toBeTruthy();
  });

  it("assigns hook intent to cover and cta intent to last page", async () => {
    const analyst = makeMockAnalyst();
    const out = await analyst.run(analystInput());
    expect(out.pages[0].copyIntent).toBe("hook");
    expect(out.pages[out.pages.length - 1].copyIntent).toBe("cta");
  });

  it("every page.claims id exists in the ledger", async () => {
    const analyst = makeMockAnalyst();
    const out = await analyst.run(analystInput());
    const ledgerIds = new Set(out.claimLedger.claims.map((c) => c.id));
    for (const p of out.pages) {
      for (const id of p.claims ?? []) {
        expect(ledgerIds.has(id)).toBe(true);
      }
    }
  });
});

describe("makeMockCopywriter", () => {
  function copyInput(layout: "P1" | "P3"): CopywriterPageInput {
    return {
      series: {
        name: baseSeries.name,
        audience: baseSeries.audience,
        tone: baseSeries.tone,
        branding: baseSeries.branding,
      },
      outline: {},
      page: {
        index: 2,
        role: "body",
        layout,
        workingTitle: "테스트 제목",
        message: "메시지",
        mappingNote: "매핑",
        copyIntent: "evidence",
        claims: ["c1", "c2"],
      },
      ledgerSlice: [
        {
          id: "c1",
          text: "사실",
          type: "fact",
          confidence: "high",
          risk: "none",
          scope: [],
        },
        {
          id: "c2",
          text: "수치",
          type: "number",
          evidence: "evidence",
          confidence: "medium",
          risk: "none",
          scope: [],
        },
      ],
      copyContext: {
        tone: "info",
        recurringTerms: [],
        usedExamples: [],
        forbiddenRepeats: [],
        committedClaims: [],
        pendingClaims: ["c1", "c2"],
      },
    };
  }

  it("produces narrative body for P1", async () => {
    const cw = makeMockCopywriter();
    const out = await cw.run(copyInput("P1"));
    expect(out.copy.body).toBeDefined();
    expect(out.copy.list).toBeUndefined();
    // Density: 3+ sentences expected.
    expect((out.copy.body as string).length).toBeGreaterThan(10);
  });

  it("produces ≥3 list items for P3", async () => {
    const cw = makeMockCopywriter();
    const out = await cw.run(copyInput("P3"));
    expect(out.copy.list).toBeDefined();
    expect(out.copy.list!.length).toBeGreaterThanOrEqual(3);
    expect(out.copy.body).toBeUndefined();
  });

  it("returns committedClaimIds as a subset of input.page.claims", async () => {
    const cw = makeMockCopywriter();
    const input = copyInput("P1");
    const out = await cw.run(input);
    expect(out.committedClaimIds).toBeDefined();
    const declared = new Set(input.page.claims ?? []);
    for (const id of out.committedClaimIds) {
      expect(declared.has(id)).toBe(true);
    }
  });
});

describe("makeMockImageDirector", () => {
  function imgInput(layout: "P1" | "P3"): ImageDirectorInput {
    return {
      preset: { imageStyle: "abstract minimal" },
      page: {
        index: 2,
        layout,
        purpose: "illustrate point",
        title: "타이틀",
      },
    };
  }

  it("emits skipReason for P3", async () => {
    const id = makeMockImageDirector();
    const out = await id.run(imgInput("P3"));
    expect(out.skipReason).toBeDefined();
  });

  it("emits non-empty prompt.text and no skipReason for P1", async () => {
    const id = makeMockImageDirector();
    const out = await id.run(imgInput("P1"));
    expect(out.skipReason).toBeUndefined();
    expect(out.prompt.text.length).toBeGreaterThan(20);
  });
});

describe("makeMockFactChecker", () => {
  it("returns ≥1 confirmed claim for topic-only input", async () => {
    const fc = makeMockFactChecker();
    const input: FactCheckerInput = {
      topic: "AI",
      sourcePolicy: baseSourcePolicy,
    };
    const out = await fc.run(input);
    expect(out.claims.length).toBeGreaterThanOrEqual(1);
    expect(out.claims[0].status).toBe("confirmed");
  });
});
