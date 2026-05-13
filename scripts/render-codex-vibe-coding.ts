#!/usr/bin/env bun
// One-off renderer for the manual CODEX vibe-coding cardnews.

import puppeteer from "puppeteer-core";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const CARD_DIR = path.resolve(
  import.meta.dir,
  "../data/series/claude/cards/2026-05-13-codex-vibe-coding-6-steps"
);
const PREVIEW_PATH = path.join(CARD_DIR, "preview.html");
const EXPORTS_DIR = path.join(CARD_DIR, "exports");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function findChrome(): Promise<string | null> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const p of CHROME_CANDIDATES) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function readPngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("not a PNG file");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function main() {
  const chromeBin = await findChrome();
  if (!chromeBin) {
    console.error("[render-codex] No Chrome found. Set PUPPETEER_EXECUTABLE_PATH.");
    process.exit(1);
  }

  await fs.mkdir(EXPORTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromeBin,
    headless: true,
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 2 },
  });

  console.log(`[render-codex] using Chrome: ${chromeBin}`);
  console.log(`[render-codex] preview:      ${PREVIEW_PATH}`);
  console.log(`[render-codex] output:       ${EXPORTS_DIR}/`);

  const probe = await browser.newPage();
  await probe.goto(`file://${PREVIEW_PATH}`, { waitUntil: "networkidle0" });
  const pageCount = await probe.$$eval(".grid > div", (cards) => cards.length);
  await probe.close();

  if (pageCount === 0) {
    throw new Error("No cards found in preview.html");
  }

  for (let i = 1; i <= pageCount; i++) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    await tab.goto(`file://${PREVIEW_PATH}`, { waitUntil: "networkidle0" });

    await tab.evaluate((idx) => {
      const cards = document.querySelectorAll(".grid > div");
      cards.forEach((el, k) => {
        (el as HTMLElement).style.display = k === idx - 1 ? "block" : "none";
      });
      const h1 = document.querySelector("h1");
      if (h1) (h1 as HTMLElement).style.display = "none";
      const meta = document.querySelector(".meta");
      if (meta) (meta as HTMLElement).style.display = "none";
      document.querySelectorAll(".card-label").forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });

      document.body.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.background = "#0e0e10";

      const chosen = cards[idx - 1] as HTMLElement;
      const card = chosen.querySelector(".card") as HTMLElement;
      const inner = chosen.querySelector(".card-inner") as HTMLElement;
      card.style.width = "1080px";
      card.style.height = "1350px";
      card.style.borderRadius = "0";
      card.style.boxShadow = "none";
      card.style.margin = "0";
      inner.style.transform = "none";
      inner.style.width = "1080px";
      inner.style.height = "1350px";
    }, i);

    await tab.evaluate(() => document.fonts.ready);

    const overflow = await tab.evaluate(() => {
      const root = document.querySelector(".card-inner") as HTMLElement;
      const bounds = root.getBoundingClientRect();
      const selectors = [
        ".strip",
        ".pageno",
        ".label",
        ".title",
        ".content",
        ".callout-slot",
        ".footer",
        ".cover-sub",
        ".doc-board",
        ".final-line",
        ".final-sub",
        ".cta-pill",
      ].join(",");
      return Array.from(root.querySelectorAll(selectors))
        .map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return {
            className: (el as HTMLElement).className,
            left: Math.round(r.left - bounds.left),
            top: Math.round(r.top - bounds.top),
            right: Math.round(r.right - bounds.left),
            bottom: Math.round(r.bottom - bounds.top),
          };
        })
        .filter((r) => r.left < -1 || r.top < -1 || r.right > 1081 || r.bottom > 1351);
    });

    if (overflow.length > 0) {
      throw new Error(`page ${i} has overflowing elements: ${JSON.stringify(overflow)}`);
    }

    const out = path.join(EXPORTS_DIR, `page-${String(i).padStart(2, "0")}.png`);
    await tab.screenshot({
      path: out,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
    });

    const bytes = await fs.readFile(out);
    const { width, height } = readPngSize(bytes);
    if (width !== 2160 || height !== 2700) {
      throw new Error(`page ${i} expected 2160x2700 PNG, got ${width}x${height}`);
    }
    if (bytes.length < 20_000) {
      throw new Error(`page ${i} PNG looks suspiciously small: ${bytes.length} bytes`);
    }

    console.log(
      `[render-codex] page-${String(i).padStart(2, "0")}.png  ${width}x${height}  ${bytes.length.toLocaleString()} bytes`
    );

    await tab.close();
  }

  await browser.close();
  console.log(`[render-codex] DONE — ${pageCount} PNGs at ${EXPORTS_DIR}/`);
}

main().catch((err) => {
  console.error("[render-codex] FATAL:", err);
  process.exit(1);
});
