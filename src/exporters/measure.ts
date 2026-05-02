import type { Page as PuppeteerPage } from "puppeteer-core";

export interface TextMeasurement {
  pageIndex: number;
  field: string;
  lineCount: number;
  bboxHeight: number;
  exceedsTwoLines: boolean;
}

export interface L2Violation {
  code: "L2/SENTENCE_OVERFLOW";
  pageIndex: number;
  field: string;
  actualLines: number;
  message: string;
}

export interface MeasurementResult {
  pageIndex: number;
  measurements: TextMeasurement[];
  violations: L2Violation[];
}

/**
 * Maximum allowed line count per measured text field.
 *
 * design-guide: "title and body text fields must not exceed 2 lines per
 * sentence". We treat any field rendered in > MAX_LINES lines as an L2
 * SENTENCE_OVERFLOW violation. Labels are exempt (single-line by convention).
 */
const MAX_LINES = 2;

/**
 * Fields that are subject to the 2-line cap. Labels render as single-line
 * tags and are excluded.
 */
const ENFORCED_FIELDS = new Set(["title", "body"]);

interface RawMeasurement {
  field: string;
  bboxHeight: number;
  lineCount: number;
}

/**
 * Run inside a Puppeteer page context. Inspects every element marked with
 * `data-measure="<field>"`, computes the line count from bbox-height /
 * line-height, and returns the measurements + any L2 violations.
 *
 * The caller is responsible for ensuring `setContent` + `document.fonts.ready`
 * have completed first; otherwise line counts are unreliable.
 */
export async function measureTextOverflow(
  pPage: PuppeteerPage,
  pageIndex: number
): Promise<MeasurementResult> {
  // Run the measurement script in the page context. We pass a string rather
  // than a function reference so unit-test mocks don't need to bind a real
  // function — the Puppeteer page mock just needs to return our shape.
  const raw = (await pPage.evaluate(MEASURE_SCRIPT)) as RawMeasurement[];

  const measurements: TextMeasurement[] = raw.map((m) => ({
    pageIndex,
    field: m.field,
    lineCount: m.lineCount,
    bboxHeight: m.bboxHeight,
    exceedsTwoLines: m.lineCount > MAX_LINES,
  }));

  const violations: L2Violation[] = [];
  for (const m of measurements) {
    if (!ENFORCED_FIELDS.has(stripIndex(m.field))) continue;
    if (m.lineCount <= MAX_LINES) continue;
    violations.push({
      code: "L2/SENTENCE_OVERFLOW",
      pageIndex,
      field: m.field,
      actualLines: m.lineCount,
      message: `page ${pageIndex} field "${m.field}" rendered in ${m.lineCount} lines (max ${MAX_LINES})`,
    });
  }

  return { pageIndex, measurements, violations };
}

function stripIndex(field: string): string {
  // "list[0]" → "list", "title" → "title"
  const i = field.indexOf("[");
  return i === -1 ? field : field.slice(0, i);
}

/**
 * Browser-side measurement script. Computes line count = round(bbox.height /
 * line-height) for each [data-measure] element. Exposed as a string so the
 * Puppeteer mock in tests can stub `evaluate()` directly.
 */
export const MEASURE_SCRIPT = `(() => {
  const els = document.querySelectorAll("[data-measure]");
  const results = [];
  for (const el of els) {
    const cs = getComputedStyle(el);
    let lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh) || lh <= 0) {
      // line-height: normal — fall back to fontSize * 1.2
      const fs = parseFloat(cs.fontSize) || 16;
      lh = fs * 1.2;
    }
    const bbox = el.getBoundingClientRect();
    const lineCount = Math.max(1, Math.round(bbox.height / lh));
    results.push({
      field: el.getAttribute("data-measure"),
      bboxHeight: bbox.height,
      lineCount,
    });
  }
  return results;
})()`;
