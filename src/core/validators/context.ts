import type { Page } from "../schemas/page";
import type { Violation } from "../schemas/card";
import { fail, ok, type ValidationResult } from "./types";

const MIN_BODY_CONTEXT_LENGTH = 30;

export function validateContext(args: { pages: Page[] }): ValidationResult {
  const violations: Violation[] = [];

  for (const page of args.pages) {
    if (!page.mappingNote || page.mappingNote.trim().length === 0) {
      violations.push({
        level: "L3",
        code: "CONTEXT/MISSING_MAPPING_NOTE",
        message: "mappingNote must be non-empty",
        pageIndex: page.index,
        field: "mappingNote",
      });
    }

    if (page.role !== "body") continue;

    const body = page.copy.body ?? "";
    if (/\d/.test(body) && body.length < MIN_BODY_CONTEXT_LENGTH) {
      violations.push({
        level: "L3",
        code: "CONTEXT/NUMBER_WITHOUT_CONTEXT",
        message: `body contains a number but is shorter than ${MIN_BODY_CONTEXT_LENGTH} characters; add explanatory context`,
        pageIndex: page.index,
        field: "body",
      });
    }
  }

  return violations.length === 0 ? ok() : fail(violations);
}
