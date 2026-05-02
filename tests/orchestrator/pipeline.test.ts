import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pipeline } from "@core/orchestrator/pipeline";
import { FileStateStore } from "@impl/file-state-store";
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

function makePipeline() {
  const stateStore = new FileStateStore(tmpRoot);
  const pipeline = new Pipeline({
    stateStore,
    analyst: makeMockAnalyst(),
    copywriter: makeMockCopywriter(),
    imageDirector: makeMockImageDirector(),
    factChecker: makeMockFactChecker(),
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

  it("start with pipelineVersion=v2-editorial is rejected with NotImplementedError", async () => {
    const { pipeline } = makePipeline();
    await expect(
      pipeline.start({
        series,
        preset,
        topic: "v2",
        sourcePolicy,
        pipelineVersion: "v2-editorial",
      })
    ).rejects.toThrow(/v2-editorial/);
  });
});
