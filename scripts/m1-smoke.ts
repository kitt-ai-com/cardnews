/**
 * M1 smoke test — runs the full mocked cardnews pipeline end-to-end.
 *
 *   start → approve(outline) → approve(copy) → approve(images) → exported
 *
 * No real LLM, image gen, render, preview, or Figma. Persists state via
 * FileStateStore in a fresh tmp dir. Prints stage transitions and a final
 * page summary, then exits 0.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pipeline, type ExporterFn } from "../src/core/orchestrator/pipeline";
import { FileStateStore } from "../src/providers-impl/file-state-store";
import {
  makeMockAnalyst,
  makeMockCopywriter,
  makeMockImageDirector,
  makeMockFactChecker,
} from "../src/providers-impl/mock-agent-runner";
import type { Series } from "../src/core/schemas/series";
import type { Preset } from "../src/core/schemas/preset";
import type { SourcePolicy } from "../src/core/schemas/source-policy";

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
  imageStyle: "neon brutalist, dark background, lime accent",
};

const sourcePolicy: SourcePolicy = {
  trustLevel: "unknown",
  factCheckMode: "skip",
};

const smokeExporter: ExporterFn = async (config) => ({
  runId: "m1-smoke",
  exportedPages: config.card.pages.map((p) => p.index),
  measurements: [],
  l2Violations: [],
  finalDir: config.outDir,
});

async function main(): Promise<void> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-m1-smoke-"));
  console.log(`[m1-smoke] state dir: ${tmpRoot}`);

  const stateStore = new FileStateStore(tmpRoot);
  const pipeline = new Pipeline({
    stateStore,
    analyst: makeMockAnalyst(),
    copywriter: makeMockCopywriter(),
    imageDirector: makeMockImageDirector(),
    factChecker: makeMockFactChecker(),
    exporter: smokeExporter,
  });

  const card0 = await pipeline.start({
    series,
    preset,
    topic: "Claude Opus 4.7 출시!",
    sourcePolicy,
  });
  console.log(`[m1-smoke] start              → status=${card0.status} id=${card0.id}`);

  const card1 = await pipeline.approve(card0.id);
  console.log(`[m1-smoke] approve(outline)   → status=${card1.status}`);

  const card2 = await pipeline.approve(card0.id);
  console.log(`[m1-smoke] approve(copy)      → status=${card2.status}`);

  const card3 = await pipeline.approve(card0.id);
  console.log(`[m1-smoke] approve(images)    → status=${card3.status}`);

  console.log(`[m1-smoke] pipelineVersion    = ${card3.pipelineVersion}`);
  console.log("[m1-smoke] page summary:");
  for (const page of card3.pages) {
    const tag = page.image ? "[img]" : "[--]";
    const title = (page.copy.title ?? "").slice(0, 40);
    console.log(
      `  ${page.index} ${page.role.padEnd(4)} ${page.layout.padEnd(5)} ${tag} ${title}`
    );
  }

  if (card3.pipelineVersion !== "v1-mocked") {
    console.error(
      `[m1-smoke] FAIL: expected pipelineVersion=v1-mocked, got ${card3.pipelineVersion}`
    );
    process.exit(1);
  }
  if (card3.status !== "exported") {
    console.error(`[m1-smoke] FAIL: expected status=exported, got ${card3.status}`);
    process.exit(1);
  }

  console.log("[m1-smoke] OK");
}

main().catch((err) => {
  console.error("[m1-smoke] ERROR", err);
  process.exit(1);
});
