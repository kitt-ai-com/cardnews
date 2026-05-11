#!/usr/bin/env bun
// Puppeteer renderer for 2026-05-12-claude-code-15tips-telegram/preview.html
// Produces 7 PNGs at 1080×1080 (square, Telegram album format).

import puppeteer from "puppeteer-core";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const CARD_DIR = path.resolve(
  import.meta.dir,
  "../data/series/claude/cards/2026-05-12-claude-code-15tips-telegram"
);
const PREVIEW_PATH = path.join(CARD_DIR, "preview.html");
const EXPORTS_DIR = path.join(CARD_DIR, "exports");
const TOTAL_PAGES = 7;

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function findChrome(): Promise<string | null> {
  for (const p of CHROME_CANDIDATES) {
    try {
      await fs.access(p);
      return p;
    } catch { /* not found */ }
  }
  return process.env.PUPPETEER_EXECUTABLE_PATH ?? null;
}

async function main() {
  const chromeBin = await findChrome();
  if (!chromeBin) {
    console.error("[render] No Chrome found. Set PUPPETEER_EXECUTABLE_PATH.");
    process.exit(1);
  }

  await fs.mkdir(EXPORTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromeBin,
    headless: true,
    defaultViewport: { width: 1080, height: 1080, deviceScaleFactor: 1 },
  });

  console.log(`[render] Chrome:   ${chromeBin}`);
  console.log(`[render] Preview:  ${PREVIEW_PATH}`);
  console.log(`[render] Output:   ${EXPORTS_DIR}/`);

  for (let i = 1; i <= TOTAL_PAGES; i++) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await tab.goto(`file://${PREVIEW_PATH}`, { waitUntil: "networkidle0" });

    await tab.evaluate((idx) => {
      const cells = document.querySelectorAll(".grid > div");
      cells.forEach((el, k) => {
        (el as HTMLElement).style.display = k === idx - 1 ? "block" : "none";
      });

      const h1 = document.querySelector("h1");
      if (h1) (h1 as HTMLElement).style.display = "none";
      const meta = document.querySelector(".meta");
      if (meta) (meta as HTMLElement).style.display = "none";

      document.body.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.background = "#0e0e10";

      const chosen = cells[idx - 1] as HTMLElement;
      const card = chosen.querySelector(".card") as HTMLElement;
      const inner = chosen.querySelector(".card-inner") as HTMLElement;
      if (card) {
        card.style.width = "1080px";
        card.style.height = "1080px";
        card.style.borderRadius = "0";
        card.style.boxShadow = "none";
        card.style.margin = "0";
      }
      if (inner) {
        inner.style.transform = "none";
        inner.style.width = "1080px";
        inner.style.height = "1080px";
      }
    }, i);

    await tab.evaluate(() => (document as Document).fonts.ready);
    await new Promise((r) => setTimeout(r, 300));

    const out = path.join(EXPORTS_DIR, `page-${String(i).padStart(2, "0")}.png`);
    await tab.screenshot({
      path: out,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });

    const stat = await fs.stat(out);
    console.log(`[render] page-${String(i).padStart(2, "0")}.png  ${stat.size.toLocaleString()} bytes`);

    await tab.close();
  }

  await browser.close();
  console.log(`[render] DONE — ${TOTAL_PAGES} PNGs at ${EXPORTS_DIR}/`);
}

main().catch((err) => {
  console.error("[render] FATAL:", err);
  process.exit(1);
});
