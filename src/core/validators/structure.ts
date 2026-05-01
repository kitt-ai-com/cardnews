import type { Card } from "../schemas/card";
import type { Violation } from "../schemas/card";
import { fail, ok, type ValidationResult } from "./types";

export function slideCountRange(sourceTextLength: number): {
  min: number;
  max: number;
} {
  if (sourceTextLength <= 500) return { min: 5, max: 6 };
  if (sourceTextLength <= 1500) return { min: 7, max: 9 };
  return { min: 10, max: 13 };
}

export interface StructureContext {
  sourceTextLength?: number;
}

export function validateStructure(
  card: Card,
  ctx: StructureContext
): ValidationResult {
  const violations: Violation[] = [];
  const pages = card.pages;

  if (pages.length === 0) {
    return fail([
      {
        level: "L3",
        code: "STRUCTURE/MISSING_COVER",
        message: "card has no pages; first page must be a cover",
        pageIndex: 1,
      },
      {
        level: "L3",
        code: "STRUCTURE/MISSING_CTA",
        message: "card has no pages; last page must be a cta",
      },
    ]);
  }

  if (pages[0].role !== "cover") {
    violations.push({
      level: "L3",
      code: "STRUCTURE/MISSING_COVER",
      message: "first page must have role 'cover'",
      pageIndex: pages[0].index,
      field: "role",
    });
  }

  const last = pages[pages.length - 1];
  if (last.role !== "cta") {
    violations.push({
      level: "L3",
      code: "STRUCTURE/MISSING_CTA",
      message: "last page must have role 'cta'",
      pageIndex: last.index,
      field: "role",
    });
  }

  const bodyLayouts = new Set(
    pages.filter((p) => p.role === "body").map((p) => p.layout)
  );
  if (bodyLayouts.size === 1) {
    violations.push({
      level: "L3",
      code: "STRUCTURE/SINGLE_LAYOUT",
      message: "body pages must use at least 2 distinct layouts",
      field: "pages",
    });
  }

  if (typeof ctx.sourceTextLength === "number") {
    const { min, max } = slideCountRange(ctx.sourceTextLength);
    if (pages.length < min || pages.length > max) {
      violations.push({
        level: "L3",
        code: "STRUCTURE/PAGE_COUNT_OUT_OF_RANGE",
        message: `page count ${pages.length} is outside [${min}, ${max}] for source text length ${ctx.sourceTextLength}`,
        details: {
          actual: pages.length,
          min,
          max,
          sourceTextLength: ctx.sourceTextLength,
        },
      });
    }
  }

  return violations.length === 0 ? ok() : fail(violations);
}
