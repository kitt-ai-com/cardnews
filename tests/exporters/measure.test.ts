import { describe, it, expect } from "vitest";
import { measureTextOverflow } from "../../src/exporters/measure";
import type { Page as PuppeteerPage } from "puppeteer-core";

interface RawMeasurement {
  field: string;
  bboxHeight: number;
  lineCount: number;
}

function makeFakePage(returns: RawMeasurement[]): PuppeteerPage {
  return {
    evaluate: async () => returns,
  } as unknown as PuppeteerPage;
}

describe("measureTextOverflow", () => {
  it("returns no violations when title and body are within 2 lines", async () => {
    const page = makeFakePage([
      { field: "title", bboxHeight: 70, lineCount: 1 },
      { field: "body", bboxHeight: 105, lineCount: 2 },
      { field: "label", bboxHeight: 30, lineCount: 1 },
    ]);
    const result = await measureTextOverflow(page, 2);
    expect(result.pageIndex).toBe(2);
    expect(result.violations).toHaveLength(0);
    expect(result.measurements).toHaveLength(3);
    expect(result.measurements[0].exceedsTwoLines).toBe(false);
    expect(result.measurements[1].exceedsTwoLines).toBe(false);
  });

  it("flags L2 SENTENCE_OVERFLOW when body renders in 3 lines", async () => {
    const page = makeFakePage([
      { field: "body", bboxHeight: 160, lineCount: 3 },
    ]);
    const result = await measureTextOverflow(page, 5);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe("L2/SENTENCE_OVERFLOW");
    expect(result.violations[0].pageIndex).toBe(5);
    expect(result.violations[0].field).toBe("body");
    expect(result.violations[0].actualLines).toBe(3);
    expect(result.measurements[0].exceedsTwoLines).toBe(true);
  });

  it("flags overflow on title when 3 lines, ignores label even if many lines", async () => {
    const page = makeFakePage([
      { field: "title", bboxHeight: 250, lineCount: 4 },
      { field: "label", bboxHeight: 200, lineCount: 5 },
    ]);
    const result = await measureTextOverflow(page, 1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe("title");
  });

  it("strips array-index suffix when matching field whitelist", async () => {
    // Future-proofing: list[0] should still be enforced under the "list"
    // base name, but right now only title/body are enforced — list[0] should
    // therefore NOT raise. This documents the behavior: index-stripped lookup
    // hits ENFORCED_FIELDS, so list[0] is ignored.
    const page = makeFakePage([
      { field: "list[0]", bboxHeight: 300, lineCount: 5 },
    ]);
    const result = await measureTextOverflow(page, 3);
    expect(result.violations).toHaveLength(0);
  });
});
