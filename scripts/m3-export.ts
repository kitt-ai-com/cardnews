#!/usr/bin/env bun
/**
 * M3.G — Acceptance script for the full mocked pipeline + real Puppeteer
 * export. Produces 1080×1350 PNGs through the same code path as the
 * production pipeline, but with mock agents so it runs without API keys.
 *
 * Usage:
 *   bun run m3:export                      → run mock pipeline + render
 *   bun run m3:export --card <cardId>      → load existing state.json + render
 *
 * Env:
 *   PUPPETEER_EXECUTABLE_PATH   path to Chrome/Chromium binary
 *                               (auto-detected on macOS / common Linux paths
 *                               when unset)
 */
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import puppeteer from "puppeteer-core";
import { Pipeline } from "../src/core/orchestrator/pipeline";
import { FileStateStore } from "../src/providers-impl/file-state-store";
import {
  FilePresetRegistry,
  FileSeriesRegistry,
} from "../src/core/registry";
import {
  makeMockAnalyst,
  makeMockCopywriter,
  makeMockImageDirector,
  makeMockFactChecker,
} from "../src/providers-impl/mock-agent-runner";
import { exportCard } from "../src/exporters/png";

const TAG = "[m3-export]";

export interface ParsedArgs {
  useExisting: boolean;
  cardId: string | null;
}

/**
 * Parse CLI argv (without the leading `bun` / script path entries).
 * Exported for unit testing.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const idx = argv.indexOf("--card");
  if (idx >= 0) {
    const cardId = argv[idx + 1];
    if (!cardId) {
      throw new Error("--card requires a card id");
    }
    return { useExisting: true, cardId };
  }
  return { useExisting: false, cardId: null };
}

/**
 * Try common macOS / Linux paths for Chrome / Chromium. Returns the first
 * existing executable, or null if none found. Exported for testing.
 */
export function findChrome(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Resolve Chrome
  const envChrome = process.env.PUPPETEER_EXECUTABLE_PATH;
  const chromeBin = envChrome && envChrome.length > 0 ? envChrome : findChrome();
  if (!chromeBin) {
    console.error(
      `${TAG} No Chrome/Chromium found. Set PUPPETEER_EXECUTABLE_PATH=...\n` +
        `  macOS:   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n` +
        `  Linux:   /usr/bin/google-chrome  (or /usr/bin/chromium)\n`
    );
    process.exit(1);
    return;
  }

  // Resolve repo paths and registries.
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const dataDir = path.join(projectRoot, "data");
  const seriesReg = new FileSeriesRegistry(dataDir);
  const presetReg = new FilePresetRegistry(dataDir);
  const series = await seriesReg.load("claude");
  const preset = await presetReg.load(series.defaultPreset);

  let cardDir: string;
  let cardId: string;
  let card: Awaited<ReturnType<Pipeline["start"]>>;

  if (args.useExisting && args.cardId) {
    const stateRoot = path.join(dataDir, "series", series.id, "cards");
    const stateStore = new FileStateStore(stateRoot);
    const loaded = await stateStore.read(args.cardId);
    if (!loaded) {
      throw new Error(`Card not found: ${args.cardId}`);
    }
    card = loaded;
    cardId = args.cardId;
    cardDir = path.join(stateRoot, cardId);
    console.log(`${TAG} loaded existing card: ${cardId} (status=${card.status})`);
  } else {
    // Run mock pipeline end-to-end. We stop at draft.images-ready so we can
    // run exportCard ourselves with the resolved chromeBin.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "m3-export-"));
    const stateStore = new FileStateStore(tmpRoot);
    const pipeline = new Pipeline({
      stateStore,
      analyst: makeMockAnalyst(),
      copywriter: makeMockCopywriter(),
      imageDirector: makeMockImageDirector(),
      factChecker: makeMockFactChecker(),
    });

    card = await pipeline.start({
      series,
      preset,
      topic: "Claude Code 시작하기",
      sourcePolicy: { trustLevel: "unknown", factCheckMode: "skip" },
    });
    console.log(`${TAG} mock pipeline started: card=${card.id}, status=${card.status}`);

    cardId = card.id;
    cardDir = path.join(tmpRoot, cardId);

    card = await pipeline.approve(card.id);
    console.log(`${TAG} after approve(outline) → ${card.status}`);
    card = await pipeline.approve(card.id);
    console.log(`${TAG} after approve(copy)    → ${card.status}`);
    // Note: the pipeline's third approve would invoke its default exporter
    // (which doesn't know about chromeBin); we run exportCard directly
    // below instead with the resolved chromeBin.
  }

  const outDir = path.join(cardDir, "exports");
  await fs.mkdir(outDir, { recursive: true });

  console.log(`${TAG} rendering ${card.pages.length} page(s) via puppeteer...`);
  const result = await exportCard({
    card,
    preset,
    series,
    outDir,
    chromeBin,
    puppeteerLaunch: puppeteer.launch.bind(puppeteer),
  });

  if (result.l2Violations.length > 0) {
    console.error(
      `${TAG} L2 violations on ${result.l2Violations.length} page(s):`
    );
    for (const v of result.l2Violations) {
      console.error(
        `  page ${v.pageIndex} ${v.field}: ${v.actualLines} lines (expected ≤ 2)`
      );
    }
    console.error(
      `${TAG} PNGs left at ${result.finalDir} for inspection.`
    );
    process.exit(2);
    return;
  }

  console.log(`${TAG} DONE`);
  console.log(`${TAG} Card directory: ${cardDir}`);
  console.log(`${TAG} Exports:`);
  for (const idx of result.exportedPages) {
    const file = path.join(
      outDir,
      `page-${String(idx).padStart(2, "0")}.png`
    );
    try {
      const stat = await fs.stat(file);
      console.log(
        `  page-${String(idx).padStart(2, "0")}.png  ${stat.size.toLocaleString()} bytes`
      );
    } catch {
      console.log(
        `  page-${String(idx).padStart(2, "0")}.png  (missing)`
      );
    }
  }
}

// Only run main when invoked directly (not when imported by tests).
// Bun exposes `import.meta.main`; under tsc we read it via index access.
function isInvokedDirectly(): boolean {
  const meta = import.meta as unknown as { main?: boolean; url?: string };
  if (typeof meta.main === "boolean") return meta.main;
  try {
    const here = meta.url ? new URL(meta.url).pathname : "";
    return process.argv[1] === here || process.argv[1] === meta.url;
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  main().catch((err) => {
    console.error(
      `${TAG} FATAL: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  });
}
