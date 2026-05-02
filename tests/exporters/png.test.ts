import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { exportCard, type LaunchFn } from "../../src/exporters/png";
import type { Card } from "@core/schemas/card";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";

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
    background: "#0e0e10",
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

function makeCard(): Card {
  return {
    id: "card-png-test",
    series: "claude",
    preset: "c1-dark-lime",
    pipelineVersion: "v1-mocked",
    sourcePolicy: { trustLevel: "unknown", factCheckMode: "skip" },
    coreMessage: "test",
    pages: [
      {
        index: 1,
        role: "cover",
        layout: "cover",
        message: "cover msg",
        mappingNote: "cover map",
        copy: { title: "cover" },
        manualEdit: false,
      },
      {
        index: 2,
        role: "body",
        layout: "P1",
        message: "body 1",
        mappingNote: "body 1 map",
        copy: { title: "body 1" },
        manualEdit: false,
      },
      {
        index: 3,
        role: "body",
        layout: "P2",
        message: "body 2",
        mappingNote: "body 2 map",
        copy: { title: "body 2" },
        manualEdit: false,
      },
      {
        index: 4,
        role: "cta",
        layout: "cta",
        message: "cta msg",
        mappingNote: "cta map",
        copy: { title: "cta" },
        manualEdit: false,
      },
    ],
    status: "draft.images-ready",
    attempts: [],
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };
}

interface FakeState {
  newPageCalls: number;
  closeCalls: number;
  screenshots: string[];
  setContentCalls: string[];
}

/**
 * Build a fake puppeteer launch that returns per-page measurements based on
 * the page index extracted from the rendered footer (`NN / NN`).
 */
function makeFakeLaunchPerPage(
  measurementsByPageIndex: Record<
    number,
    Array<{ field: string; lineCount: number }>
  >
): { launch: LaunchFn; state: FakeState } {
  const state: FakeState = {
    newPageCalls: 0,
    closeCalls: 0,
    screenshots: [],
    setContentCalls: [],
  };

  const launch: LaunchFn = async () => {
    return {
      newPage: async () => {
        state.newPageCalls++;
        let currentPageIdxFromContent: number | null = null;
        return {
          setViewport: async () => undefined,
          setContent: async (html: string) => {
            state.setContentCalls.push(html);
            // Pull "NN / NN" out of the rendered footer to know which card
            // page is in this tab. Footer renders e.g. "02 / 04".
            const m = />(\d{2}) \/ \d{2}</.exec(html);
            currentPageIdxFromContent = m ? parseInt(m[1], 10) : null;
          },
          evaluateHandle: async () => undefined,
          evaluate: async () => {
            if (
              currentPageIdxFromContent &&
              measurementsByPageIndex[currentPageIdxFromContent]
            ) {
              return measurementsByPageIndex[currentPageIdxFromContent];
            }
            return [{ field: "title", bboxHeight: 50, lineCount: 1 }];
          },
          screenshot: async (sopts: { path: string }) => {
            await fs.writeFile(sopts.path, Buffer.from([0x89]));
            state.screenshots.push(sopts.path);
          },
          close: async () => {
            state.closeCalls++;
          },
        };
      },
      close: async () => undefined,
    } as unknown as Awaited<ReturnType<LaunchFn>>;
  };

  return { launch, state };
}

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-png-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("exportCard", () => {
  it("happy path: 4 pages export, atomic swap to outDir, index.json present", async () => {
    const card = makeCard();
    const { launch } = makeFakeLaunchPerPage({});
    const result = await exportCard({
      card,
      preset,
      series,
      outDir: tmpRoot,
      puppeteerLaunch: launch,
      runIdGen: () => "run0001",
    });

    expect(result.l2Violations).toHaveLength(0);
    expect(result.exportedPages).toEqual([1, 2, 3, 4]);
    expect(result.finalDir).toBe(tmpRoot);

    // Files in outDir:
    const expectedFiles = [
      "page-01.png",
      "page-02.png",
      "page-03.png",
      "page-04.png",
      "index.json",
    ];
    for (const f of expectedFiles) {
      const stat = await fs.stat(path.join(tmpRoot, f));
      expect(stat.isFile()).toBe(true);
    }

    // .runs/<runId>/ removed.
    const runsExists = await fs
      .stat(path.join(tmpRoot, ".runs"))
      .then(() => true)
      .catch(() => false);
    expect(runsExists).toBe(false);

    // index.json content shape:
    const idx = JSON.parse(
      await fs.readFile(path.join(tmpRoot, "index.json"), "utf-8")
    );
    expect(idx.cardId).toBe("card-png-test");
    expect(idx.runId).toBe("run0001");
    expect(idx.pages).toHaveLength(4);
    expect(idx.pages[0]).toEqual({
      pageIndex: 1,
      fileName: "page-01.png",
      layout: "cover",
    });
  });

  it("L2 violation on page 2: files stay in .runs/<runId>/, outDir has nothing new", async () => {
    const card = makeCard();
    const { launch } = makeFakeLaunchPerPage({
      2: [{ field: "body", lineCount: 4 }],
    });
    const result = await exportCard({
      card,
      preset,
      series,
      outDir: tmpRoot,
      puppeteerLaunch: launch,
      runIdGen: () => "run-bad",
    });

    expect(result.l2Violations).toHaveLength(1);
    expect(result.l2Violations[0].pageIndex).toBe(2);
    expect(result.l2Violations[0].code).toBe("L2/SENTENCE_OVERFLOW");
    expect(result.finalDir).toBe(path.join(tmpRoot, ".runs", "run-bad"));

    // Verify run dir has the PNGs, outDir has only the run dir (no PNGs / index).
    const runDirEntries = (
      await fs.readdir(path.join(tmpRoot, ".runs", "run-bad"))
    ).sort();
    expect(runDirEntries).toEqual([
      "page-01.png",
      "page-02.png",
      "page-03.png",
      "page-04.png",
    ]);
    const outDirEntries = await fs.readdir(tmpRoot);
    expect(outDirEntries).toEqual([".runs"]);
  });

  it("scope subset: only pages [2, 3] are rendered", async () => {
    const card = makeCard();
    const { launch, state } = makeFakeLaunchPerPage({});
    const result = await exportCard({
      card,
      preset,
      series,
      outDir: tmpRoot,
      scope: [2, 3],
      puppeteerLaunch: launch,
      runIdGen: () => "run-scope",
    });

    expect(result.exportedPages).toEqual([2, 3]);
    expect(state.newPageCalls).toBe(2);
    expect(state.screenshots.length).toBe(2);

    const outDirEntries = (await fs.readdir(tmpRoot)).sort();
    expect(outDirEntries).toEqual(["index.json", "page-02.png", "page-03.png"]);
  });

  it("ignores invalid scope indices not present on the card", async () => {
    const card = makeCard();
    const { launch } = makeFakeLaunchPerPage({});
    const result = await exportCard({
      card,
      preset,
      series,
      outDir: tmpRoot,
      scope: [3, 99],
      puppeteerLaunch: launch,
      runIdGen: () => "run-scope2",
    });
    expect(result.exportedPages).toEqual([3]);
  });
});
