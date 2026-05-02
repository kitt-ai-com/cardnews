#!/usr/bin/env bun
// One-off renderer for the manual MVP cardnews preview.html →
// 1080×1350 PNG per page. Bypasses the M3 React pipeline since this
// card was hand-crafted in HTML.

import puppeteer from "puppeteer-core";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const CARD_DIR = path.resolve(
  import.meta.dir,
  "../data/series/claude/cards/2026-05-02-claude-code-getting-started"
);
const PREVIEW_PATH = path.join(CARD_DIR, "preview.html");
const EXPORTS_DIR = path.join(CARD_DIR, "exports");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

async function findChrome(): Promise<string | null> {
  for (const p of CHROME_CANDIDATES) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* not found */
    }
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
    defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 2 },
  });

  console.log(`[render] using Chrome: ${chromeBin}`);
  console.log(`[render] preview:      ${PREVIEW_PATH}`);
  console.log(`[render] output:       ${EXPORTS_DIR}/`);

  for (let i = 1; i <= 8; i++) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    await tab.goto(`file://${PREVIEW_PATH}`, { waitUntil: "networkidle0" });

    // Pin the target card to the viewport at native 1080×1350,
    // and hide everything else (including the page heading + meta).
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

      // Strip body padding so the card sits flush at viewport top-left.
      document.body.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.background = "#0e0e10";

      // Find the chosen card and reset its transform scale to 1.
      const chosen = cards[idx - 1] as HTMLElement;
      const card = chosen.querySelector(".card") as HTMLElement;
      const inner = chosen.querySelector(".card-inner") as HTMLElement;
      if (card) {
        card.style.width = "1080px";
        card.style.height = "1350px";
        card.style.borderRadius = "0";
        card.style.boxShadow = "none";
        card.style.margin = "0";
      }
      if (inner) {
        inner.style.transform = "none";
        inner.style.width = "1080px";
        inner.style.height = "1350px";
      }
    }, i);

    // Wait for Pretendard webfont + any background images to resolve.
    await tab.evaluate(() => (document as Document).fonts.ready);
    await new Promise((r) => setTimeout(r, 200)); // tiny extra cushion

    const out = path.join(EXPORTS_DIR, `page-${String(i).padStart(2, "0")}.png`);
    await tab.screenshot({
      path: out,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
    });

    const stat = await fs.stat(out);
    console.log(
      `[render] page-${String(i).padStart(2, "0")}.png  ${stat.size.toLocaleString()} bytes`
    );

    await tab.close();
  }

  await browser.close();
  console.log(`[render] DONE — 8 PNGs at ${EXPORTS_DIR}/`);
}

main().catch((err) => {
  console.error("[render] FATAL:", err);
  process.exit(1);
});
