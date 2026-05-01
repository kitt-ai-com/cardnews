import { describe, expect, it } from "vitest";
import { validateContext } from "@core/validators/context";
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
  copy: Page["copy"],
  mappingNote = `note-${index}`
): Page {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote,
    copy,
    manualEdit: false,
  };
}

describe("validateContext", () => {
  it("passes for pages with valid mappingNote and sufficient body", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", {
        title: "T",
        body: "이 회사는 작년 한 해 동안 매출이 6000억 원에 달했고 견조한 성장세를 이어갔다.",
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    expect(r.ok).toBe(true);
  });

  it("flags CONTEXT/MISSING_MAPPING_NOTE when mappingNote is whitespace", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }, "   "),
      makePage(2, "body", "P1", {
        title: "T",
        body: "충분한 맥락의 문장들. 둘째 문장.",
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    const v = r.violations.find(
      (x) => x.code === "CONTEXT/MISSING_MAPPING_NOTE"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(1);
  });

  it("flags CONTEXT/NUMBER_WITHOUT_CONTEXT for body with bare number", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", { title: "T", body: "매출 6000억 원" }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    const v = r.violations.find(
      (x) => x.code === "CONTEXT/NUMBER_WITHOUT_CONTEXT"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
    expect(v?.field).toBe("body");
  });

  it("does NOT flag NUMBER_WITHOUT_CONTEXT when number has sufficient context", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", {
        title: "T",
        body: "지난 분기의 누적 매출은 6000억 원에 달하며 성장했다.",
      }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    expect(
      r.violations.some((x) => x.code === "CONTEXT/NUMBER_WITHOUT_CONTEXT")
    ).toBe(false);
  });

  it("does NOT flag NUMBER_WITHOUT_CONTEXT for numbers in title only", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }),
      makePage(2, "body", "P1", { title: "매출 6000억", body: undefined }),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    expect(
      r.violations.some((x) => x.code === "CONTEXT/NUMBER_WITHOUT_CONTEXT")
    ).toBe(false);
  });

  it("only mappingNote check applies to cover and cta", () => {
    // cover/cta with bare number in body should NOT be flagged
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover", body: "6000" }),
      makePage(2, "body", "P1", {
        title: "T",
        body: "충분히 긴 문장입니다 그리고 더 많은 맥락도 있다.",
      }),
      makePage(3, "cta", "cta", { title: "CTA", body: "6000" }),
    ];
    const r = validateContext({ pages });
    expect(
      r.violations.some((x) => x.code === "CONTEXT/NUMBER_WITHOUT_CONTEXT")
    ).toBe(false);
  });

  it("collects multiple violations across pages", () => {
    const pages: Page[] = [
      makePage(1, "cover", "cover", { title: "Cover" }, ""),
      makePage(2, "body", "P1", { title: "T", body: "매출 6000억" }, ""),
      makePage(3, "cta", "cta", { title: "CTA" }),
    ];
    const r = validateContext({ pages });
    expect(r.ok).toBe(false);
    expect(
      r.violations.filter((x) => x.code === "CONTEXT/MISSING_MAPPING_NOTE")
        .length
    ).toBe(2);
    expect(
      r.violations.filter((x) => x.code === "CONTEXT/NUMBER_WITHOUT_CONTEXT")
        .length
    ).toBe(1);
  });
});
