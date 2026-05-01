import { describe, expect, it } from "vitest";
import {
  slideCountRange,
  validateStructure,
} from "@core/validators/structure";
import type { Card } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";

type LayoutId =
  | "cover"
  | "cta"
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7";

function makePage(
  index: number,
  role: "cover" | "body" | "cta",
  layout: LayoutId
): Page {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote: `n${index}`,
    copy: { title: `T${index}` },
    manualEdit: false,
  };
}

function makeCard(pages: Page[]): Card {
  return {
    id: "card",
    series: "claude",
    preset: "c1-dark-lime",
    sourcePolicy: { trustLevel: "unknown", factCheckMode: "strict" },
    coreMessage: "core",
    pages,
    status: "draft.outline-ready",
    attempts: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("slideCountRange", () => {
  it("returns 5-6 for sourceTextLength <= 500", () => {
    expect(slideCountRange(0)).toEqual({ min: 5, max: 6 });
    expect(slideCountRange(500)).toEqual({ min: 5, max: 6 });
  });

  it("returns 7-9 for 500 < length <= 1500", () => {
    expect(slideCountRange(501)).toEqual({ min: 7, max: 9 });
    expect(slideCountRange(1500)).toEqual({ min: 7, max: 9 });
  });

  it("returns 10-13 for length > 1500", () => {
    expect(slideCountRange(1501)).toEqual({ min: 10, max: 13 });
    expect(slideCountRange(99999)).toEqual({ min: 10, max: 13 });
  });
});

describe("validateStructure", () => {
  const wellFormed = makeCard([
    makePage(1, "cover", "cover"),
    makePage(2, "body", "P1"),
    makePage(3, "body", "P2"),
    makePage(4, "body", "P3"),
    makePage(5, "cta", "cta"),
  ]);

  it("passes for a well-formed card with no sourceTextLength", () => {
    const r = validateStructure(wellFormed, {});
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("flags STRUCTURE/MISSING_COVER when first page role !== 'cover'", () => {
    const card = makeCard([
      makePage(1, "body", "P1"),
      makePage(2, "body", "P2"),
      makePage(3, "cta", "cta"),
    ]);
    const r = validateStructure(card, {});
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "STRUCTURE/MISSING_COVER")).toBe(
      true
    );
  });

  it("flags STRUCTURE/MISSING_CTA when last page role !== 'cta'", () => {
    const card = makeCard([
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
    ]);
    const r = validateStructure(card, {});
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "STRUCTURE/MISSING_CTA")).toBe(
      true
    );
  });

  it("flags STRUCTURE/SINGLE_LAYOUT when body pages use only 1 distinct layout", () => {
    const card = makeCard([
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P1"),
      makePage(4, "cta", "cta"),
    ]);
    const r = validateStructure(card, {});
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "STRUCTURE/SINGLE_LAYOUT")).toBe(
      true
    );
  });

  it("flags STRUCTURE/PAGE_COUNT_OUT_OF_RANGE when too few pages for source length", () => {
    // 4 pages but source length 1000 expects 7-9
    const card = makeCard([
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "cta", "cta"),
    ]);
    const r = validateStructure(card, { sourceTextLength: 1000 });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.code === "STRUCTURE/PAGE_COUNT_OUT_OF_RANGE")
    ).toBe(true);
  });

  it("flags STRUCTURE/PAGE_COUNT_OUT_OF_RANGE when too many pages for source length", () => {
    const pages: Page[] = [makePage(1, "cover", "cover")];
    for (let i = 2; i <= 14; i++) {
      pages.push(makePage(i, "body", i % 2 === 0 ? "P1" : "P2"));
    }
    pages.push(makePage(15, "cta", "cta"));
    const card = makeCard(pages);
    const r = validateStructure(card, { sourceTextLength: 200 });
    expect(
      r.violations.some((v) => v.code === "STRUCTURE/PAGE_COUNT_OUT_OF_RANGE")
    ).toBe(true);
  });

  it("skips page-count check when sourceTextLength is undefined", () => {
    const card = makeCard([
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "cta", "cta"),
    ]);
    const r = validateStructure(card, {});
    expect(
      r.violations.some((v) => v.code === "STRUCTURE/PAGE_COUNT_OUT_OF_RANGE")
    ).toBe(false);
  });

  it("passes when page count is within range for given source length", () => {
    // 5 pages, sourceTextLength 300 → expects 5-6, 5 is OK
    const card = makeCard([
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "body", "P3"),
      makePage(5, "cta", "cta"),
    ]);
    const r = validateStructure(card, { sourceTextLength: 300 });
    expect(r.ok).toBe(true);
  });
});
