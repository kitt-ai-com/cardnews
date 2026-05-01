import type { Page } from "../schemas/page";
import type { Violation } from "../schemas/card";
import { fail, ok, type ValidationResult } from "./types";

const LIST_LAYOUTS = new Set(["P3", "P5"]);

/**
 * Counts complete sentences in `text`. A sentence is a chunk of non-empty text
 * terminated by `.`, `!`, or `?` (followed by whitespace or end-of-string).
 *
 * Bare keywords with no terminator return 0.
 */
export function countSentences(text: string): number {
  if (!text) return 0;
  // Match runs of characters that end with a sentence terminator.
  // The terminator must be followed by whitespace or end-of-string.
  const matches = text.match(/[^.!?]+[.!?](?=\s|$)/g);
  if (!matches) return 0;
  return matches.filter((s) => s.trim().length > 0).length;
}

export function validateDensity(args: { pages: Page[] }): ValidationResult {
  const violations: Violation[] = [];

  for (const page of args.pages) {
    if (page.role !== "body") continue;

    if (LIST_LAYOUTS.has(page.layout)) {
      const list = page.copy.list ?? [];
      list.forEach((item, i) => {
        if (countSentences(item) < 1) {
          violations.push({
            level: "L3",
            code: "DENSITY/LIST_ITEM_TOO_SHORT",
            message: `list item must contain at least 1 complete sentence`,
            pageIndex: page.index,
            field: `list[${i}]`,
          });
        }
      });
    } else {
      const body = page.copy.body ?? "";
      if (countSentences(body) < 3) {
        violations.push({
          level: "L3",
          code: "DENSITY/NARRATIVE_TOO_SHORT",
          message: "narrative body must contain at least 3 sentences",
          pageIndex: page.index,
          field: "body",
        });
      }
    }
  }

  return violations.length === 0 ? ok() : fail(violations);
}
