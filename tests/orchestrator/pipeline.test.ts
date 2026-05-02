import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pipeline, type ExporterFn } from "@core/orchestrator/pipeline";
import { FileStateStore } from "@impl/file-state-store";
import type {
  ExportConfig,
  ExportResult,
} from "../../src/exporters/png";
import {
  makeMockAnalyst,
  makeMockCopywriter,
  makeMockImageDirector,
  makeMockFactChecker,
} from "@impl/mock-agent-runner";
import type { Series } from "@core/schemas/series";
import type { Preset } from "@core/schemas/preset";
import type { SourcePolicy } from "@core/schemas/source-policy";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-pipeline-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const series: Series = {
  id: "claude",
  name: "Claude Series",
  theme: "ai",
  defaultPreset: "c1-dark-lime",
  audience: "devs",
  tone: "informative",
  branding: { seriesTag: "#claude" },
  footerHandle: "@claude",
  trustedDomains: [],
  imageProvider: "codex-image",
};

const preset: Preset = {
  id: "c1-dark-lime",
  name: "Dark Lime",
  canvas: { width: 1080, height: 1350 },
  colors: {
    background: "#0b0d10",
    text: "#f5f5f5",
    accent: "#c8ff00",
    muted: "#888888",
  },
  typography: {
    fontFamily: ["Pretendard", "system-ui"],
    title: { size: 60, weight: 800, lineHeight: 1.15, letterSpacing: -1 },
    body: { size: 36, weight: 500, lineHeight: 1.45, letterSpacing: 0 },
    label: { size: 22, weight: 600, lineHeight: 1.3, letterSpacing: 0 },
    hierarchyRatio: 1.5,
  },
  spacing: {
    safeZone: { top: 80, right: 60, bottom: 120, left: 60 },
    verticalBands: { header: 0.15, body: 0.6, footer: 0.25 },
    contentRatio: 0.6,
  },
  layouts: ["cover", "cta", "P1", "P2", "P3", "P4", "P5"],
  imageStyle: "neon brutalist",
};

const sourcePolicy: SourcePolicy = {
  trustLevel: "unknown",
  factCheckMode: "skip",
};

/**
 * Default test exporter: succeeds with no L2 violations and reports every
 * page index as exported. Used wherever a test only cares about the status
 * machine, not the renderer.
 */
const passingExporter: ExporterFn = async (
  config: ExportConfig
): Promise<ExportResult> => ({
  runId: "test-run",
  exportedPages: config.card.pages.map((p) => p.index),
  measurements: [],
  l2Violations: [],
  finalDir: config.outDir,
});

function makePipeline(opts: { exporter?: ExporterFn } = {}) {
  const stateStore = new FileStateStore(tmpRoot);
  const pipeline = new Pipeline({
    stateStore,
    analyst: makeMockAnalyst(),
    copywriter: makeMockCopywriter(),
    imageDirector: makeMockImageDirector(),
    factChecker: makeMockFactChecker(),
    exporter: opts.exporter ?? passingExporter,
    now: () => "2026-05-02T00:00:00.000Z",
    idGen: () => "card-test-001",
  });
  return { stateStore, pipeline };
}

describe("Pipeline", () => {
  it("start produces an outline-ready v1-mocked card with at least 4 pages", async () => {
    const { pipeline } = makePipeline();
    const card = await pipeline.start({
      series,
      preset,
      topic: "테스트 토픽",
      sourcePolicy,
    });
    expect(card.pipelineVersion).toBe("v1-mocked");
    expect(card.status).toBe("draft.outline-ready");
    expect(card.pages.length).toBeGreaterThanOrEqual(4);
    expect(card.pages[0].role).toBe("cover");
    expect(card.pages[card.pages.length - 1].role).toBe("cta");
  });

  it("start → approve(outline) → approve(copy) → approve(images) → exported", async () => {
    const { pipeline } = makePipeline();
    const card0 = await pipeline.start({
      series,
      preset,
      topic: "Claude Opus 4.7 출시!",
      sourcePolicy,
    });
    expect(card0.status).toBe("draft.outline-ready");

    const card1 = await pipeline.approve(card0.id);
    expect(card1.status).toBe("draft.copy-ready");
    // body pages now have copy with title
    const body1 = card1.pages.find((p) => p.role === "body");
    expect(body1).toBeDefined();
    expect(body1!.copy.title.length).toBeGreaterThan(0);

    const card2 = await pipeline.approve(card0.id);
    expect(card2.status).toBe("draft.images-ready");
    // P3 / P5 body pages skip images; other body pages have image set
    for (const page of card2.pages) {
      if (page.role !== "body") continue;
      if (page.layout === "P3" || page.layout === "P5") {
        expect(page.image).toBeUndefined();
      } else {
        expect(page.image).toBeDefined();
        expect(page.image!.path).toContain(card0.id);
        expect(page.image!.manualOverride).toBe(false);
      }
    }

    const card3 = await pipeline.approve(card0.id);
    expect(card3.status).toBe("exported");
  });

  it("resume restores card state from disk via a fresh Pipeline", async () => {
    const { pipeline, stateStore } = makePipeline();
    const card = await pipeline.start({
      series,
      preset,
      topic: "복구 테스트",
      sourcePolicy,
    });

    const fresh = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: makeMockCopywriter(),
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
    });
    const resumed = await fresh.resume(card.id);
    expect(resumed.id).toBe(card.id);
    expect(resumed.status).toBe("draft.outline-ready");

    await expect(fresh.resume("nonexistent-id")).rejects.toThrow(
      /card not found/
    );
  });

  it("v2-editorial start lands at draft.claims-ready with full v2 fields populated", async () => {
    const { pipeline } = makePipeline();
    const card = await pipeline.start({
      series,
      preset,
      topic: "v2 토픽",
      sourcePolicy,
      pipelineVersion: "v2-editorial",
    });
    expect(card.pipelineVersion).toBe("v2-editorial");
    expect(card.status).toBe("draft.claims-ready");
    expect(card.thesis).toBeDefined();
    expect(card.thesis!.length).toBeGreaterThan(0);
    expect(card.audienceQuestion).toBeDefined();
    expect(card.narrativeArc).toBeDefined();
    expect(card.claimLedger).toBeDefined();
    expect(card.claimLedger!.claims.length).toBeGreaterThan(0);
    // every page must have copyIntent (v2 superRefine guarantees this).
    for (const page of card.pages) {
      expect(page.copyIntent).toBeDefined();
    }
  });

  it("v2-editorial: claims-ready → copy-ready → images-ready → exported", async () => {
    // Use a "clean" copywriter that emits non-assertive copy (no `~다.`
    // sentence endings) so the default mock-analyst's claim ledger — which
    // includes a low-confidence claim — does not trip
    // EDITORIAL/LOW_CONFIDENCE_ASSERTION. This isolates the happy-path
    // status transitions from the violation case below.
    const stateStore = new FileStateStore(tmpRoot);
    const cleanCopywriter = makeMockCopywriter();
    const originalRun = cleanCopywriter.run.bind(cleanCopywriter);
    cleanCopywriter.run = async (input) => {
      const out = await originalRun(input);
      if (input.page.role === "body") {
        out.copy = {
          title: out.copy.title,
          // declarative-but-non-assertive Korean: ends with 요 / 보세요
          body:
            "첫 번째 흐름으로 시작해요. 두 번째 흐름이 맥락을 보여줘요. 세 번째 흐름으로 마무리해요.",
        };
      }
      return out;
    };
    const pipeline = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: cleanCopywriter,
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
      exporter: passingExporter,
      now: () => "2026-05-02T00:00:00.000Z",
      idGen: () => "card-test-v2-happy",
    });

    const card0 = await pipeline.start({
      series,
      preset,
      topic: "Claude Opus 4.7 출시!",
      sourcePolicy,
      pipelineVersion: "v2-editorial",
    });
    expect(card0.status).toBe("draft.claims-ready");

    const card1 = await pipeline.approve(card0.id);
    expect(card1.status).toBe("draft.copy-ready");
    // v2 fields preserved through Copywriter pass.
    expect(card1.thesis).toBe(card0.thesis);
    expect(card1.claimLedger).toEqual(card0.claimLedger);

    const card2 = await pipeline.approve(card0.id);
    expect(card2.status).toBe("draft.images-ready");

    const card3 = await pipeline.approve(card0.id);
    expect(card3.status).toBe("exported");
  });

  it("v2-editorial: editorial violations land at draft.review-blocked, force-advance unblocks", async () => {
    // Construct a pipeline whose mock Copywriter emits an evaluative word
    // ("강력하다") in the body of pages whose only claim is a low-confidence
    // claim — the Editorial Review must flag EVALUATIVE_NO_BACKING.
    const stateStore = new FileStateStore(tmpRoot);
    const evilCopywriter = makeMockCopywriter();
    const originalRun = evilCopywriter.run.bind(evilCopywriter);
    evilCopywriter.run = async (input) => {
      const out = await originalRun(input);
      if (input.page.role === "body") {
        out.copy = {
          title: out.copy.title,
          body:
            "이 도구는 강력하다. 엄청나게 좋은 결과를 내준다. 충격적인 효과가 있다.",
        };
      }
      return out;
    };

    const pipeline = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: evilCopywriter,
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
      exporter: passingExporter,
      now: () => "2026-05-02T00:00:00.000Z",
      idGen: () => "card-test-evil",
    });

    const card0 = await pipeline.start({
      series,
      preset,
      topic: "강력한 도구",
      sourcePolicy,
      pipelineVersion: "v2-editorial",
    });
    expect(card0.status).toBe("draft.claims-ready");

    const card1 = await pipeline.approve(card0.id);
    expect(card1.status).toBe("draft.review-blocked");
    expect(card1.violations).toBeDefined();
    expect(card1.violations!.length).toBeGreaterThan(0);
    expect(
      card1.violations!.some((v) =>
        v.code.startsWith("EDITORIAL/")
      )
    ).toBe(true);
    expect(card1.recoverOptions?.forceProceed).toBe(true);

    // forceAdvance moves to copy-ready; approve continues normally.
    const card2 = await pipeline.forceAdvanceFromReviewBlocked(card0.id);
    expect(card2.status).toBe("draft.copy-ready");

    const card3 = await pipeline.approve(card0.id);
    expect(card3.status).toBe("draft.images-ready");

    const card4 = await pipeline.approve(card0.id);
    expect(card4.status).toBe("exported");
  });

  it("v1: L2 violation on first export retries through writing → copy-ready → imaging → exported", async () => {
    const stateStore = new FileStateStore(tmpRoot);

    let attemptCount = 0;
    const observedStatuses: string[] = [];

    const flakyExporter: ExporterFn = async (config) => {
      attemptCount++;
      // Snapshot the on-disk status when the exporter is invoked. By contract
      // the pipeline transitions to draft.rendering before calling us, so this
      // must always read "draft.rendering".
      const card = await stateStore.read(config.card.id);
      if (card) observedStatuses.push(card.status);

      if (attemptCount === 1) {
        // Pretend page 2 overflowed.
        return {
          runId: "run-bad-1",
          exportedPages: config.card.pages.map((p) => p.index),
          measurements: [],
          l2Violations: [
            {
              code: "L2/SENTENCE_OVERFLOW",
              pageIndex: 2,
              field: "body",
              actualLines: 4,
              message: "page 2 body 4 lines",
            },
          ],
          finalDir: `${config.outDir}/.runs/run-bad-1`,
        };
      }
      return {
        runId: "run-good-2",
        exportedPages: config.card.pages.map((p) => p.index),
        measurements: [],
        l2Violations: [],
        finalDir: config.outDir,
      };
    };

    const pipeline = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: makeMockCopywriter(),
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
      exporter: flakyExporter,
      now: () => "2026-05-02T00:00:00.000Z",
      idGen: () => "card-test-l2",
    });

    const card0 = await pipeline.start({
      series,
      preset,
      topic: "L2 test topic",
      sourcePolicy,
    });
    expect(card0.status).toBe("draft.outline-ready");

    const card1 = await pipeline.approve(card0.id);
    expect(card1.status).toBe("draft.copy-ready");

    const card2 = await pipeline.approve(card0.id);
    expect(card2.status).toBe("draft.images-ready");

    const card3 = await pipeline.approve(card0.id);
    // After L2 rollback + retry, must arrive at exported.
    expect(card3.status).toBe("exported");
    expect(attemptCount).toBe(2);
    // Both export attempts saw draft.rendering on disk.
    expect(observedStatuses).toEqual(["draft.rendering", "draft.rendering"]);
  });

  it("v1: L2 violation persisting beyond MAX_RENDER_RETRIES lands draft.failed", async () => {
    const stateStore = new FileStateStore(tmpRoot);

    const alwaysFailingExporter: ExporterFn = async (config) => ({
      runId: "run-fail",
      exportedPages: config.card.pages.map((p) => p.index),
      measurements: [],
      l2Violations: [
        {
          code: "L2/SENTENCE_OVERFLOW",
          pageIndex: 2,
          field: "body",
          actualLines: 5,
          message: "page 2 body too long",
        },
      ],
      finalDir: `${config.outDir}/.runs/run-fail`,
    });

    const pipeline = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: makeMockCopywriter(),
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
      exporter: alwaysFailingExporter,
      now: () => "2026-05-02T00:00:00.000Z",
      idGen: () => "card-test-l2-perma",
    });

    const card0 = await pipeline.start({
      series,
      preset,
      topic: "permanent overflow",
      sourcePolicy,
    });
    await pipeline.approve(card0.id); // copy-ready
    await pipeline.approve(card0.id); // images-ready
    const card3 = await pipeline.approve(card0.id);

    expect(card3.status).toBe("draft.failed");
    expect(card3.violations?.some((v) => v.code === "L2/SENTENCE_OVERFLOW")).toBe(
      true
    );
  });
});
