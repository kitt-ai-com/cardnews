import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import type { Card, Violation } from "../schemas/card";
import type { Claim } from "../schemas/claim";
import type { Page } from "../schemas/page";
import { fail, ok, type ValidationResult } from "./types";

/**
 * Optional context for the Editorial Review validator.
 * - `evaluativeWordList`: either an inline list of evaluative words, or a path
 *   to a JSON file containing such a list. Takes precedence over `dictionaryPath`.
 * - `dictionaryPath`: path to the JSON file holding the evaluative-word
 *   blacklist (Korean by default). Used as a fallback when `evaluativeWordList`
 *   is not provided.
 *
 * If neither is provided, the default dictionary at
 * `data/dictionaries/evaluative-ko.json` is loaded.
 */
export interface EditorialContext {
  evaluativeWordList?: string[] | string;
  dictionaryPath?: string;
}

const DEFAULT_DICTIONARY_PATH = "data/dictionaries/evaluative-ko.json";

const dictionaryCache = new Map<string, string[]>();

/**
 * Detect repo root by walking up from cwd looking for the cardnews package.json.
 * Falls back to process.cwd().
 */
function findRepoRoot(): string {
  let current = process.cwd();
  const maxDepth = 10;
  let depth = 0;
  while (depth < maxDepth) {
    try {
      const pkgPath = path.join(current, "package.json");
      const content = fsSync.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.name === "@design-agent/cardnews") {
        return current;
      }
    } catch {
      // not a package.json or not the right one
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    depth++;
  }
  return process.cwd();
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.join(findRepoRoot(), p);
}

/**
 * Load the evaluative-word blacklist. Resolution order:
 * - If `pathOrInline` is a string[], return as-is.
 * - If `pathOrInline` is a string, treat it as a path to a JSON file.
 * - Otherwise, fall back to `fallbackPath` if provided, else the default
 *   `data/dictionaries/evaluative-ko.json`.
 *
 * Results are cached by resolved path.
 */
export async function loadEvaluativeWords(
  pathOrInline: string[] | string | undefined,
  fallbackPath?: string
): Promise<string[]> {
  if (Array.isArray(pathOrInline)) {
    return pathOrInline;
  }
  const targetPath =
    typeof pathOrInline === "string"
      ? pathOrInline
      : (fallbackPath ?? DEFAULT_DICTIONARY_PATH);

  const resolved = resolvePath(targetPath);
  const cached = dictionaryCache.get(resolved);
  if (cached) return cached;

  try {
    const raw = await fs.readFile(resolved, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
      throw new Error(
        `Dictionary at ${resolved} must be a JSON array of strings`
      );
    }
    dictionaryCache.set(resolved, parsed);
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to load evaluative-word dictionary from ${resolved}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Concatenate a page's user-visible copy fields into one string for keyword
 * and sentence-form analysis.
 */
export function collectCopyText(page: Page): string {
  const parts: string[] = [];
  const c = page.copy;
  if (c.title) parts.push(c.title);
  if (c.subtitle) parts.push(c.subtitle);
  if (c.body) parts.push(c.body);
  if (c.list) parts.push(...c.list);
  if (c.highlight) parts.push(c.highlight);
  return parts.join("\n");
}

/**
 * Detect at least one Korean assertive sentence in the text. We treat sentences
 * as runs separated by `.`, `!`, `?`, or newline. A run counts as assertive
 * when its trimmed length is >= 10 chars and it ends in a flat declarative
 * Korean form ("이다." / "다." / "이다!" / "다!" — punctuation matched on the
 * original text immediately after the run).
 *
 * The 10-char floor prevents triggering on tiny labels and titles like
 * "필수다." that are ornamental rather than load-bearing.
 */
export function hasAssertiveSentence(text: string): boolean {
  if (!text) return false;
  // Iterate by splitting on terminator chars but remembering the terminator.
  const re = /[^.!?\n]+[.!?]?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const segment = match[0].trim();
    if (segment.length < 10) continue;
    // Strip trailing punctuation; check stem ends with 다 or 이다.
    const stem = segment.replace(/[.!?]+$/u, "");
    if (/(이다|다)$/u.test(stem)) {
      // Require terminating punctuation to avoid catching mid-clause "다" usage.
      if (/[.!]$/u.test(segment)) return true;
    }
  }
  return false;
}

function claimById(card: Card, id: string): Claim | undefined {
  return card.claimLedger?.claims.find((c) => c.id === id);
}

/**
 * Editorial Review validator (M2.F).
 *
 * Runs the six L3 checks defined in
 * docs/superpowers/specs/2026-05-02-claim-ledger-revision.md §8:
 *   - EDITORIAL/UNSUPPORTED_CLAIM
 *   - EDITORIAL/LOW_CONFIDENCE_ASSERTION
 *   - EDITORIAL/OUTDATED_NO_DATE
 *   - EDITORIAL/EVALUATIVE_NO_BACKING
 *   - EDITORIAL/UNUSED_CLAIM
 *   - EDITORIAL/THIN_ARC
 *
 * Short-circuits with `ok()` on v1-mocked cards or any card lacking a
 * claimLedger — Editorial Review only applies to v2-editorial cards.
 */
export async function validateEditorial(
  card: Card,
  ctx: EditorialContext = {}
): Promise<ValidationResult> {
  if (card.pipelineVersion !== "v2-editorial" || !card.claimLedger) {
    return ok();
  }

  const evaluativeWords = await loadEvaluativeWords(
    ctx.evaluativeWordList,
    ctx.dictionaryPath
  );

  const violations: Violation[] = [];

  // ---- Per-page checks ----
  for (const page of card.pages) {
    // cover and cta have different rhetorical rules; skip per spec.
    if (page.role === "cover" || page.role === "cta") continue;

    const copyText = collectCopyText(page);
    const pageClaims = page.claims ?? [];
    const isAssertive = hasAssertiveSentence(copyText);

    // 1. UNSUPPORTED_CLAIM — assertive copy but no Claim refs.
    if (pageClaims.length === 0 && isAssertive) {
      violations.push({
        level: "L3",
        code: "EDITORIAL/UNSUPPORTED_CLAIM",
        message: `Page ${page.index} makes assertive statements but references no Claim ids.`,
        pageIndex: page.index,
      });
    }

    // 2. LOW_CONFIDENCE_ASSERTION — assertive copy backed by a low-confidence claim.
    for (const cid of pageClaims) {
      const c = claimById(card, cid);
      if (c?.confidence === "low" && isAssertive) {
        violations.push({
          level: "L3",
          code: "EDITORIAL/LOW_CONFIDENCE_ASSERTION",
          message: `Page ${page.index} uses assertive form for low-confidence claim '${cid}'.`,
          pageIndex: page.index,
          details: { claimId: cid },
        });
      }
    }

    // 3. OUTDATED_NO_DATE — outdated claim without a date surfaced in copy or notes.
    for (const cid of pageClaims) {
      const c = claimById(card, cid);
      if (c?.risk === "outdated") {
        const sourceNotes = page.sourceNotes ?? [];
        const dateMentioned =
          (typeof c.asOf === "string" &&
            c.asOf.length > 0 &&
            copyText.includes(c.asOf)) ||
          sourceNotes.some((n) => /\d{4}/.test(n));
        if (!dateMentioned) {
          violations.push({
            level: "L3",
            code: "EDITORIAL/OUTDATED_NO_DATE",
            message: `Page ${page.index} uses outdated claim '${cid}' without surfacing a date.`,
            pageIndex: page.index,
            details: { claimId: cid },
          });
        }
      }
    }

    // 4. EVALUATIVE_NO_BACKING — evaluative word with no high-confidence backing claim.
    const matchedEval = evaluativeWords.filter((w) => copyText.includes(w));
    if (matchedEval.length > 0) {
      const hasHighBacking = pageClaims.some(
        (cid) => claimById(card, cid)?.confidence === "high"
      );
      if (!hasHighBacking) {
        violations.push({
          level: "L3",
          code: "EDITORIAL/EVALUATIVE_NO_BACKING",
          message: `Page ${page.index} uses evaluative words [${matchedEval.join(", ")}] without high-confidence claim backing.`,
          pageIndex: page.index,
          details: { words: matchedEval },
        });
      }
    }
  }

  // ---- Card-level checks ----

  // 5. UNUSED_CLAIM — high-confidence claim never referenced by any page.
  const usedIds = new Set<string>();
  for (const p of card.pages) {
    for (const cid of p.claims ?? []) usedIds.add(cid);
  }
  for (const c of card.claimLedger.claims) {
    if (c.confidence === "high" && !usedIds.has(c.id)) {
      violations.push({
        level: "L3",
        code: "EDITORIAL/UNUSED_CLAIM",
        message: `High-confidence claim '${c.id}' is in the ledger but no page references it.`,
        details: { claimId: c.id },
      });
    }
  }

  // 6. THIN_ARC — narrativeArc has >= 3 sections that are empty or < 10 chars.
  if (card.narrativeArc) {
    const sections = [
      "hook",
      "context",
      "mechanism",
      "evidence",
      "implication",
      "action",
    ] as const;
    const arc = card.narrativeArc;
    const empty = sections.filter((k) => (arc[k] ?? "").trim().length < 10);
    if (empty.length >= 3) {
      violations.push({
        level: "L3",
        code: "EDITORIAL/THIN_ARC",
        message: `Narrative arc has ${empty.length} thin sections: ${empty.join(", ")}.`,
        details: { thinSections: empty },
      });
    }
  }

  return violations.length === 0 ? ok() : fail(violations);
}
