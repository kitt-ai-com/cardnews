import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import puppeteer, {
  type Browser,
  type Page as PuppeteerPage,
  type LaunchOptions,
  type PuppeteerLaunchOptions,
} from "puppeteer-core";
import type { Card } from "@core/schemas/card";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { renderPageHTML } from "./render-page";
import {
  measureTextOverflow,
  type L2Violation,
  type MeasurementResult,
} from "./measure";

export type LaunchFn = (
  options?: LaunchOptions | PuppeteerLaunchOptions
) => Promise<Browser>;

export interface ExportConfig {
  card: Card;
  preset: Preset;
  series: Series;
  /** Absolute output directory. Final PNGs land at <outDir>/page-NN.png */
  outDir: string;
  /** "all" exports every page; otherwise only the specified 1-based indices. */
  scope?: "all" | number[];
  /** Path to Chrome/Chromium binary. Required when using the default launcher. */
  chromeBin?: string;
  /** Inject a custom puppeteer.launch — used by tests. */
  puppeteerLaunch?: LaunchFn;
  /** Pretendard CSS to inline (woff2 base64 url). */
  pretendardCSS?: string;
  /** Optional override for runId generation — used by tests. */
  runIdGen?: () => string;
}

export interface ExportResult {
  runId: string;
  /** Page indices that were rendered into the run dir (regardless of L2). */
  exportedPages: number[];
  /** Per-page measurements (always populated, success or violation). */
  measurements: MeasurementResult[];
  /** L2 violations across all pages. If non-empty, swap was NOT performed. */
  l2Violations: L2Violation[];
  /** Where the rendered PNGs ended up — outDir on success, runDir on failure. */
  finalDir: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function defaultRunId(): string {
  // 8-char hex is unique enough across local exports of one day.
  return crypto.randomBytes(4).toString("hex");
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function safeRmDir(p: string): Promise<void> {
  await fs.rm(p, { recursive: true, force: true });
}

async function writeAtomic(filePath: string, data: string): Promise<void> {
  const tmp = `${filePath}.tmp-${crypto.randomBytes(3).toString("hex")}`;
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, filePath);
}

interface RenderedFile {
  pageIndex: number;
  fileName: string;
  runPath: string;
}

interface IndexJsonEntry {
  pageIndex: number;
  fileName: string;
  layout: string;
}

interface IndexJson {
  cardId: string;
  series: string;
  preset: string;
  runId: string;
  generatedAt: string;
  pages: IndexJsonEntry[];
}

function resolveScope(card: Card, scope: ExportConfig["scope"]): number[] {
  if (!scope || scope === "all") {
    return card.pages.map((p) => p.index);
  }
  const all = new Set(card.pages.map((p) => p.index));
  return scope.filter((i) => all.has(i));
}

/**
 * Export a Card to PNGs through Puppeteer with transactional run-dir + L2
 * measurement. Workflow:
 *
 *   1. Generate runId, mkdir <outDir>/.runs/<runId>/
 *   2. Launch puppeteer (or use injected launcher).
 *   3. For each page in scope:
 *        - Render HTML, set viewport 1080×1350@2x, setContent, fonts.ready,
 *          measure, screenshot into runDir.
 *   4. If any L2 violations: leave PNGs in runDir, return result without swap.
 *   5. Otherwise: rename each PNG into outDir, write index.json atomically,
 *      remove runDir.
 */
export async function exportCard(config: ExportConfig): Promise<ExportResult> {
  const runId = (config.runIdGen ?? defaultRunId)();
  const runsRoot = path.join(config.outDir, ".runs");
  const runDir = path.join(runsRoot, runId);
  const pageIndices = resolveScope(config.card, config.scope);

  await ensureDir(runDir);

  const launchFn: LaunchFn =
    config.puppeteerLaunch ??
    ((opts) =>
      puppeteer.launch({
        ...opts,
        executablePath: config.chromeBin,
        headless: true,
      }));

  const browser = await launchFn({
    executablePath: config.chromeBin,
    headless: true,
  });

  const measurements: MeasurementResult[] = [];
  const rendered: RenderedFile[] = [];

  try {
    for (const pageIndex of pageIndices) {
      const page = config.card.pages.find((p) => p.index === pageIndex);
      if (!page) continue;

      const html = renderPageHTML({
        card: config.card,
        page,
        preset: config.preset,
        series: config.series,
        imageSrc: page.image?.path,
        pretendardCSS: config.pretendardCSS,
      });

      const tab: PuppeteerPage = await browser.newPage();
      try {
        await tab.setViewport({
          width: config.preset.canvas.width,
          height: config.preset.canvas.height,
          deviceScaleFactor: 2,
        });
        await tab.setContent(html, { waitUntil: "networkidle0" });
        // Wait for fonts to load. Some mocks expose evaluateHandle as a no-op.
        try {
          await tab.evaluateHandle("document.fonts && document.fonts.ready");
        } catch {
          // fonts.ready not available — proceed.
        }

        const m = await measureTextOverflow(tab, pageIndex);
        measurements.push(m);

        const fileName = `page-${pad2(pageIndex)}.png`;
        const runPath = path.join(runDir, fileName);
        await tab.screenshot({
          path: runPath,
          type: "png",
          omitBackground: false,
        });
        rendered.push({ pageIndex, fileName, runPath });
      } finally {
        await tab.close();
      }
    }
  } finally {
    await browser.close();
  }

  const l2Violations: L2Violation[] = measurements.flatMap((m) => m.violations);

  if (l2Violations.length > 0) {
    // Leave the run dir for inspection; do NOT swap into outDir.
    return {
      runId,
      exportedPages: rendered.map((r) => r.pageIndex),
      measurements,
      l2Violations,
      finalDir: runDir,
    };
  }

  // Atomic swap: rename each PNG into outDir, then write index.json atomically.
  await ensureDir(config.outDir);
  for (const r of rendered) {
    const dest = path.join(config.outDir, r.fileName);
    // Best-effort: clear any prior file at dest first (rename overwrites on
    // POSIX, but be explicit so a stale file doesn't survive).
    await fs.rm(dest, { force: true });
    await fs.rename(r.runPath, dest);
  }

  const indexJson: IndexJson = {
    cardId: config.card.id,
    series: config.series.id,
    preset: config.preset.id,
    runId,
    generatedAt: new Date().toISOString(),
    pages: rendered.map((r) => {
      const p = config.card.pages.find((pp) => pp.index === r.pageIndex);
      return {
        pageIndex: r.pageIndex,
        fileName: r.fileName,
        layout: p?.layout ?? "unknown",
      };
    }),
  };
  await writeAtomic(
    path.join(config.outDir, "index.json"),
    JSON.stringify(indexJson, null, 2)
  );

  // Clean up: remove runDir; also runsRoot if empty.
  await safeRmDir(runDir);
  try {
    const remaining = await fs.readdir(runsRoot);
    if (remaining.length === 0) {
      await safeRmDir(runsRoot);
    }
  } catch {
    // runsRoot already gone — fine.
  }

  return {
    runId,
    exportedPages: rendered.map((r) => r.pageIndex),
    measurements,
    l2Violations: [],
    finalDir: config.outDir,
  };
}
