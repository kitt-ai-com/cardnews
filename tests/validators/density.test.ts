import { describe, expect, it } from "vitest";
import {
  countSentences,
  validateDensity,
} from "@core/validators/density";
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
  layout: LayoutId,
  copy: Page["copy"]
): Page {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote: `n${index}`,
    copy,
    manualEdit: false,
  };
}

describe("countSentences", () => {
  it("returns 0 for empty string", () => {
    expect(countSentences("")).toBe(0);
  });

  it("counts a single Korean sentence ending in period", () => {
    expect(countSentences("한 문장.")).toBe(1);
  });

  it("counts mixed punctuation", () => {
    expect(countSentences("Hello. World!")).toBe(2);
  });

  it("counts question mark + period", () => {
    expect(countSentences("질문? 답이 있다.")).toBe(2);
  });

  it("returns 0 for a bare keyword", () => {
    expect(countSentences("키워드")).toBe(0);
  });
});

describe("validateDensity", () => {
  it("passes for narrative body with 4 sentences", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", {
        title: "T",
        body: "첫째. 둘째. 셋째. 넷째.",
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(r.ok).toBe(true);
  });

  it("flags DENSITY/NARRATIVE_TOO_SHORT for narrative body with 1 sentence", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", { title: "T", body: "한 문장." }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(r.ok).toBe(false);
    const v = r.violations.find(
      (x) => x.code === "DENSITY/NARRATIVE_TOO_SHORT"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
    expect(v?.field).toBe("body");
  });

  it("flags DENSITY/LIST_ITEM_TOO_SHORT for list page with bare keyword items", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P3", {
        title: "T",
        list: ["키워드1", "키워드2"],
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(r.ok).toBe(false);
    const offenders = r.violations.filter(
      (x) => x.code === "DENSITY/LIST_ITEM_TOO_SHORT"
    );
    expect(offenders.length).toBe(2);
    expect(offenders[0].field).toBe("list[0]");
    expect(offenders[0].pageIndex).toBe(2);
    expect(offenders[1].field).toBe("list[1]");
  });

  it("passes for list page with full sentences", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P3", {
        title: "T",
        list: ["첫번째 완전한 문장이다.", "둘째 완전한 문장이다."],
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(r.ok).toBe(true);
  });

  it("also handles P5 as a list layout", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P5", { title: "T", list: ["키워드"] }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(
      r.violations.some((v) => v.code === "DENSITY/LIST_ITEM_TOO_SHORT")
    ).toBe(true);
  });

  it("ignores cover and cta pages", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Short" }),
      makePage(2, "body", "P1", {
        title: "T",
        body: "첫째. 둘째. 셋째.",
      }),
      makePage(3, "cta", "cta", { title: "Short", body: "짧다." }),
    ];
    const r = validateDensity({ pages });
    expect(r.ok).toBe(true);
  });

  it("narrative page missing body is flagged", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", { title: "T" }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateDensity({ pages });
    expect(
      r.violations.some((v) => v.code === "DENSITY/NARRATIVE_TOO_SHORT")
    ).toBe(true);
  });
});
