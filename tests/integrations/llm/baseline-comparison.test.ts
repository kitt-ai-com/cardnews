import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  loadBaseline,
  compareToBaseline,
  renderComparisonReport,
  type BaselineMeta,
} from "../../../src/integrations/llm/baseline-comparison";
import { CardSchema, type Card } from "../../../src/core/schemas/card";

const testDir = import.meta.dirname;
const projectRoot = path.join(testDir, "../../..");
const canonicalBaselinePath = path.join(
  projectRoot,
  "data/series/claude/cards/2026-05-01-claude-code-three/baseline.json"
);

function makeFullV2Card(overrides: Partial<Card> = {}): Card {
  // Build a healthy v2 card with 6 pages, claim ledger, narrative arc,
  // copyIntent on every page, and 2+ distinct body layouts.
  const claims = [
    {
      id: "c1",
      text: "Claim 1",
      type: "fact",
      confidence: "high",
      sourceRef: "https://example.com/a",
      risk: "none",
      scope: [],
    },
    {
      id: "c2",
      text: "Claim 2",
      type: "fact",
      confidence: "high",
      sourceRef: "https://example.com/b",
      risk: "none",
      scope: [],
    },
    {
      id: "c3",
      text: "Claim 3",
      type: "interpretation",
      confidence: "medium",
      risk: "none",
      scope: [],
    },
    {
      id: "c4",
      text: "Claim 4",
      type: "fact",
      confidence: "high",
      sourceRef: "https://example.com/d",
      risk: "none",
      scope: [],
    },
    {
      id: "c5",
      text: "Claim 5",
      type: "fact",
      confidence: "medium",
      risk: "none",
      scope: [],
    },
    {
      id: "c6",
      text: "Claim 6",
      type: "fact",
      confidence: "high",
      sourceRef: "https://example.com/f",
      risk: "none",
      scope: [],
    },
  ];

  const raw = {
    id: "v2-test-card",
    series: "claude",
    preset: "c1-dark-lime",
    pipelineVersion: "v2-editorial",
    topic: "v2 test topic",
    sourcePolicy: { trustLevel: "primary", factCheckMode: "strict" },
    coreMessage: "Six-section thesis under test.",
    thesis: "Six-section thesis under test.",
    audienceQuestion: "Why does this matter to the reader?",
    narrativeArc: {
      hook: "An evocative opening line for the reader.",
      context: "Background: who this is for and why now.",
      mechanism: "How it works under the hood, step by step.",
      evidence: "Concrete numbers and citations from the ledger.",
      implication: "What this means for the reader's workflow.",
      action: "A specific call to try it next.",
    },
    claimLedger: {
      claims,
      sourceDigest: {
        sources: [],
        audienceQuestion: "Why does this matter?",
      },
    },
    pages: [
      {
        index: 1,
        role: "cover",
        layout: "cover",
        copyIntent: "hook",
        infoPattern: "I1",
        message: "cover msg",
        mappingNote: "cover mapping note",
        claims: [],
        copy: { title: "Cover" },
        manualEdit: false,
      },
      {
        index: 2,
        role: "body",
        layout: "P1",
        copyIntent: "context",
        infoPattern: "I1",
        message: "body 1 msg",
        mappingNote: "body 1 mapping",
        claims: ["c1", "c2"],
        copy: { title: "Body 1" },
        manualEdit: false,
      },
      {
        index: 3,
        role: "body",
        layout: "P2",
        copyIntent: "mechanism",
        infoPattern: "I3",
        message: "body 2 msg",
        mappingNote: "body 2 mapping",
        claims: ["c3"],
        copy: { title: "Body 2" },
        manualEdit: false,
      },
      {
        index: 4,
        role: "body",
        layout: "P3",
        copyIntent: "evidence",
        infoPattern: "I2",
        message: "body 3 msg",
        mappingNote: "body 3 mapping",
        claims: ["c4", "c5"],
        copy: { title: "Body 3" },
        manualEdit: false,
      },
      {
        index: 5,
        role: "body",
        layout: "P4",
        copyIntent: "warning",
        infoPattern: "I4",
        message: "body 4 msg",
        mappingNote: "body 4 mapping",
        claims: ["c6"],
        copy: { title: "Body 4" },
        manualEdit: false,
      },
      {
        index: 6,
        role: "cta",
        layout: "cta",
        copyIntent: "cta",
        infoPattern: "I1",
        message: "cta msg",
        mappingNote: "cta mapping",
        claims: [],
        copy: { title: "CTA" },
        manualEdit: false,
      },
    ],
    status: "draft.claims-ready",
    attempts: [],
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z",
  };

  const parsed = CardSchema.parse(raw);
  return { ...parsed, ...overrides };
}

describe("baseline-comparison", () => {
  describe("loadBaseline", () => {
    it("loads the canonical claude-code-three baseline", async () => {
      const meta = await loadBaseline(canonicalBaselinePath);
      expect(meta.id).toBe("2026-05-01-claude-code-three");
      expect(meta.series).toBe("claude");
      expect(meta.pipelineVersion).toBe("v1-mocked");
      expect(meta.stats.pageCount).toBe(8);
      expect(meta.stats.imageProvider).toBe("codex-image");
      expect(Array.isArray(meta.comparisonAxes)).toBe(true);
      expect(meta.comparisonAxes.length).toBeGreaterThan(0);
    });

    it("throws on missing file", async () => {
      await expect(
        loadBaseline(path.join(testDir, "_fixtures/__nope__.json"))
      ).rejects.toThrow(/Baseline not found/);
    });

    it("throws on missing required fields", async () => {
      // The fixture file path doesn't matter since we use try/catch
      // — point to one that exists but has wrong shape.
      // We use the package.json which exists but lacks our schema.
      const pkg = path.join(projectRoot, "package.json");
      await expect(loadBaseline(pkg)).rejects.toThrow(/missing required field/);
    });
  });

  describe("compareToBaseline", () => {
    it("produces a 5-axis result", async () => {
      const v1 = await loadBaseline(canonicalBaselinePath);
      const v2 = makeFullV2Card();
      const result = compareToBaseline(v1, v2);

      expect(result.axes).toHaveLength(5);
      expect(result.axes.map((a) => a.axis)).toEqual([
        "facts accuracy",
        "depth",
        "narrative arc",
        "rhetorical diversity",
        "visual diversity",
      ]);
      expect(result.summary).toContain(v2.id);
      expect(result.summary).toContain(v1.id);
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.v1).toBe(v1);
      expect(result.v2Card).toBe(v2);
    });

    it("scores facts accuracy 'high' when claim count >= 5", async () => {
      const v1 = await loadBaseline(canonicalBaselinePath);
      const v2 = makeFullV2Card();
      const result = compareToBaseline(v1, v2);
      const axis = result.axes.find((a) => a.axis === "facts accuracy")!;
      expect(axis.v1Score).toBe("n/a");
      expect(axis.v2Score).toBe("high");
      expect(axis.evidence).toMatch(/\d+ claim/);
    });

    it("scores facts accuracy 'medium' when claim count < 5", async () => {
      const v1 = await loadBaseline(canonicalBaselinePath);
      const full = makeFullV2Card();
      // Construct a sparse-claim card by parsing fresh with only 2 claims,
      // and only referencing those ids on pages.
      const sparseRaw = {
        ...full,
        claimLedger: {
          claims: full.claimLedger!.claims.slice(0, 2),
          sourceDigest: full.claimLedger!.sourceDigest,
        },
        pages: full.pages.map((p) => ({
          ...p,
          claims: (p.claims ?? []).filter(
            (cid) => cid === "c1" || cid === "c2"
          ),
        })),
      };
      const v2 = CardSchema.parse(sparseRaw);
      const result = compareToBaseline(v1, v2);
      const axis = result.axes.find((a) => a.axis === "facts accuracy")!;
      expect(axis.v2Score).toBe("medium");
    });

    it("scores depth 'medium' when narrative arc has thin sections", async () => {
      const v1 = await loadBaseline(canonicalBaselinePath);
      const full = makeFullV2Card();
      const thinRaw = {
        ...full,
        narrativeArc: {
          hook: "A nice substantive hook line.",
          context: "Context paragraph that is long enough.",
          mechanism: "Mechanism description that exceeds ten chars.",
          evidence: "Evidence is also a paragraph here.",
          // Two thin sections (<=10 chars trimmed):
          implication: "short.",
          action: "go.",
        },
      };
      const v2 = CardSchema.parse(thinRaw);
      const result = compareToBaseline(v1, v2);
      const axis = result.axes.find((a) => a.axis === "depth")!;
      expect(axis.v2Score).toBe("medium");
    });
  });

  describe("renderComparisonReport", () => {
    it("emits markdown with all 5 axes, summary, and timestamp", async () => {
      const v1 = await loadBaseline(canonicalBaselinePath);
      const v2 = makeFullV2Card();
      const result = compareToBaseline(v1, v2);
      const md = renderComparisonReport(result);

      expect(md).toContain("# Baseline Comparison: v2 vs v1");
      expect(md).toContain("## Axes");
      expect(md).toContain("### 1. Facts Accuracy");
      expect(md).toContain("### 2. Depth");
      expect(md).toContain("### 3. Narrative Arc");
      expect(md).toContain("### 4. Rhetorical Diversity");
      expect(md).toContain("### 5. Visual Diversity");
      expect(md).toContain("## Summary");
      expect(md).toContain("## Generated");
      expect(md).toContain(result.generatedAt);
      expect(md).toContain(v1.id);
      expect(md).toContain(v2.id);
    });
  });
});
