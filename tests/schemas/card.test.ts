import { describe, expect, it } from "vitest";
import { CardSchema } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";

function makePage(
  index: number,
  role: "cover" | "body" | "cta",
  layout: "cover" | "cta" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7"
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

const baseCard = {
  id: "2026-05-01-test",
  series: "claude",
  preset: "c1-dark-lime",
  topic: "test",
  sourcePolicy: { trustLevel: "unknown", factCheckMode: "strict" },
  coreMessage: "core",
  pages: [
    makePage(1, "cover", "cover"),
    makePage(2, "body", "P1"),
    makePage(3, "body", "P2"),
    makePage(4, "cta", "cta"),
  ],
  status: "draft.outline-ready",
  attempts: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("Card", () => {
  it("accepts a valid card", () => {
    expect(() => CardSchema.parse(baseCard)).not.toThrow();
  });

  it("rejects when first page is not 'cover'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[0].role = "body";
    expect(() => CardSchema.parse(bad)).toThrow(/first page.*cover/i);
  });

  it("rejects when last page is not 'cta'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[bad.pages.length - 1].role = "body";
    expect(() => CardSchema.parse(bad)).toThrow(/last page.*cta/i);
  });

  it("rejects middle page that isn't 'body'", () => {
    const bad = structuredClone(baseCard);
    bad.pages[1].role = "cover";
    // also rebalance to keep the cover/cta roles intact otherwise this would
    // also trip the first/last refines, depending on order
    expect(() => CardSchema.parse(bad)).toThrow(/middle pages.*body/i);
  });

  it("rejects when only one body layout type used", () => {
    const bad = structuredClone(baseCard);
    bad.pages[2].layout = "P1"; // both body pages are P1
    expect(() => CardSchema.parse(bad)).toThrow(/at least 2.*body layouts/i);
  });

  it("rejects pages array of length < 3", () => {
    const bad = structuredClone(baseCard);
    bad.pages = [makePage(1, "cover", "cover"), makePage(2, "cta", "cta")];
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("attempts defaults to []", () => {
    const { attempts: _omit, ...rest } = baseCard;
    const out = CardSchema.parse(rest);
    expect(out.attempts).toEqual([]);
  });

  it("rejects unknown status", () => {
    const bad = structuredClone(baseCard);
    (bad as unknown as { status: string }).status = "paused-for-approval";
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("rejects unknown failedStage", () => {
    const bad = structuredClone(baseCard);
    (bad as unknown as { failedStage: string }).failedStage = "wat";
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it("accepts a valid failedStage enum", () => {
    const ok = structuredClone(baseCard);
    (ok as unknown as { failedStage: string }).failedStage = "copywriter";
    expect(() => CardSchema.parse(ok)).not.toThrow();
  });

  it("accepts a card with 5 pages and ≥2 body layouts", () => {
    const ok = structuredClone(baseCard);
    ok.pages = [
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "body", "P3"),
      makePage(5, "cta", "cta"),
    ];
    expect(() => CardSchema.parse(ok)).not.toThrow();
  });
});
