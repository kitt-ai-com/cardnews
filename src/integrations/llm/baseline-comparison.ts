/**
 * Baseline comparison generator.
 *
 * Compares a v2 (editorial pipeline) Card against the canonical v1 baseline
 * (manual MVP — `claude-code-three`) along five axes from the spec addendum
 * §10:
 *
 *   1. facts accuracy        — claim ledger presence + claim count + confidence
 *   2. depth                 — narrative arc completeness (6 sections >10 chars)
 *   3. narrative arc         — explicit 6-section arc vs implicit 3-section
 *   4. rhetorical diversity  — distinct copyIntent values across pages
 *   5. visual diversity      — distinct layouts + infoPatterns used
 *
 * Output: a Markdown report ready to drop into the card's directory.
 */
import * as fs from "node:fs/promises";
import type { Card } from "@core/schemas/card";

export type Score = "n/a" | "low" | "medium" | "high";

export interface BaselineMeta {
  id: string;
  series: string;
  preset: string;
  pipelineVersion: "v1-mocked" | "v2-editorial";
  topic?: string;
  coreMessage: string;
  createdAt?: string;
  kind?: string;
  note?: string;
  stats: {
    pageCount: number;
    layoutsUsed: string[];
    infoPatternsUsed: string[];
    imagesGenerated: number;
    imageProvider: string;
  };
  knownLimitations?: string[];
  comparisonAxes: string[];
}

export interface ComparisonAxis {
  axis: string;
  v1Score: Score;
  v2Score: Score;
  evidence: string;
}

export interface BaselineComparison {
  v1: BaselineMeta;
  v2Card: Card;
  axes: ComparisonAxis[];
  summary: string;
  generatedAt: string;
}

/**
 * Load a baseline.json file from disk and validate its essential shape.
 */
export async function loadBaseline(filePath: string): Promise<BaselineMeta> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Baseline not found: ${filePath}`);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Baseline at ${filePath} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Baseline at ${filePath} must be a JSON object`);
  }

  const obj = parsed as Record<string, unknown>;
  const required = [
    "id",
    "series",
    "preset",
    "pipelineVersion",
    "coreMessage",
    "stats",
    "comparisonAxes",
  ];
  for (const k of required) {
    if (!(k in obj)) {
      throw new Error(`Baseline at ${filePath} missing required field: ${k}`);
    }
  }

  const stats = obj.stats as Record<string, unknown>;
  for (const k of [
    "pageCount",
    "layoutsUsed",
    "infoPatternsUsed",
    "imagesGenerated",
    "imageProvider",
  ]) {
    if (!(k in stats)) {
      throw new Error(`Baseline at ${filePath} missing stats.${k}`);
    }
  }

  return parsed as BaselineMeta;
}

/**
 * Build the 5-axis comparison record. Pure function — does no I/O.
 */
export function compareToBaseline(
  v1: BaselineMeta,
  v2: Card
): BaselineComparison {
  const axes: ComparisonAxis[] = [
    buildFactsAccuracyAxis(v1, v2),
    buildDepthAxis(v1, v2),
    buildNarrativeArcAxis(v1, v2),
    buildRhetoricalDiversityAxis(v1, v2),
    buildVisualDiversityAxis(v1, v2),
  ];

  const summary = buildSummary(v1, v2, axes);

  return {
    v1,
    v2Card: v2,
    axes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Render the comparison as a Markdown document.
 */
export function renderComparisonReport(c: BaselineComparison): string {
  const lines: string[] = [];
  lines.push("# Baseline Comparison: v2 vs v1");
  lines.push("");
  lines.push(
    `**v1 baseline:** \`${c.v1.id}\` (${c.v1.kind ?? "manual MVP"}, ${
      c.v1.createdAt ?? "n/d"
    })`
  );
  lines.push(
    `**v2 card:** \`${c.v2Card.id}\` (full editorial pipeline, ${c.v2Card.createdAt})`
  );
  if (c.v1.topic || c.v2Card.topic) {
    lines.push("");
    if (c.v1.topic) lines.push(`- v1 topic: ${c.v1.topic}`);
    if (c.v2Card.topic) lines.push(`- v2 topic: ${c.v2Card.topic}`);
  }
  lines.push("");
  lines.push("## Axes");
  lines.push("");

  c.axes.forEach((axis, i) => {
    lines.push(`### ${i + 1}. ${capitalize(axis.axis)}`);
    lines.push(`- v1: ${axis.v1Score}`);
    lines.push(`- v2: ${axis.v2Score}`);
    lines.push(`- Evidence: ${axis.evidence}`);
    lines.push("");
  });

  lines.push("## Summary");
  lines.push("");
  lines.push(c.summary);
  lines.push("");
  lines.push("## Generated");
  lines.push("");
  lines.push(c.generatedAt);
  lines.push("");

  return lines.join("\n");
}

// --- private axis builders --------------------------------------------------

function buildFactsAccuracyAxis(
  _v1: BaselineMeta,
  v2: Card
): ComparisonAxis {
  const claims = v2.claimLedger?.claims ?? [];
  const total = claims.length;
  const high = claims.filter((c) => c.confidence === "high").length;
  const sourced = claims.filter((c) => c.sourceRef).length;

  let v2Score: Score;
  if (total === 0) v2Score = "low";
  else if (total < 5) v2Score = "medium";
  else v2Score = "high";

  const evidence =
    total === 0
      ? "v2 card has no claim ledger — facts are not structured."
      : `v2 ledger has ${total} claim(s), ${high} high-confidence, ${sourced} with sourceRef. v1 baseline had no claim ledger and relied on manual review.`;

  return {
    axis: "facts accuracy",
    v1Score: "n/a",
    v2Score,
    evidence,
  };
}

function buildDepthAxis(_v1: BaselineMeta, v2: Card): ComparisonAxis {
  const arc = v2.narrativeArc;
  if (!arc) {
    return {
      axis: "depth",
      v1Score: "low",
      v2Score: "low",
      evidence:
        "v2 card has no narrativeArc; depth is comparable to v1's implicit 3-section flow.",
    };
  }

  const sections: Array<[string, string]> = [
    ["hook", arc.hook],
    ["context", arc.context],
    ["mechanism", arc.mechanism],
    ["evidence", arc.evidence],
    ["implication", arc.implication],
    ["action", arc.action],
  ];
  const filled = sections.filter(([, txt]) => (txt ?? "").trim().length > 10);
  const filledCount = filled.length;

  let v2Score: Score;
  if (filledCount >= 6) v2Score = "high";
  else if (filledCount >= 4) v2Score = "medium";
  else v2Score = "low";

  const evidence =
    `v2 narrative arc has ${filledCount}/6 sections with substantive content (>10 chars). ` +
    `v1 baseline used a 3-section flow (intro / body / cta) without explicit mechanism, evidence, or implication framing.`;

  return {
    axis: "depth",
    v1Score: "low",
    v2Score,
    evidence,
  };
}

function buildNarrativeArcAxis(
  _v1: BaselineMeta,
  v2: Card
): ComparisonAxis {
  const has = !!v2.narrativeArc;
  const v2Score: Score = has ? "high" : "low";
  const evidence = has
    ? "v2 card encodes the full 6-section arc (hook → context → mechanism → evidence → implication → action). v1 baseline implicitly had 3 sections (skills/hooks/loop)."
    : "v2 card lacks narrativeArc; comparable to v1's implicit 3-section flow.";
  return {
    axis: "narrative arc",
    v1Score: "low",
    v2Score,
    evidence,
  };
}

function buildRhetoricalDiversityAxis(
  _v1: BaselineMeta,
  v2: Card
): ComparisonAxis {
  const intents = v2.pages
    .map((p) => p.copyIntent)
    .filter((x): x is NonNullable<typeof x> => !!x);
  const distinct = new Set(intents);
  const distinctCount = distinct.size;

  let v2Score: Score;
  if (distinctCount === 0) v2Score = "low";
  else if (distinctCount <= 2) v2Score = "low";
  else if (distinctCount <= 4) v2Score = "medium";
  else v2Score = "high";

  const evidence =
    distinctCount === 0
      ? "v2 pages have no copyIntent set; rhetorical roles are implicit (same as v1)."
      : `v2 uses ${distinctCount} distinct copyIntent(s) across ${v2.pages.length} pages: ${[...distinct].join(", ")}. v1 baseline did not record copyIntent.`;

  return {
    axis: "rhetorical diversity",
    v1Score: "n/a",
    v2Score,
    evidence,
  };
}

function buildVisualDiversityAxis(
  v1: BaselineMeta,
  v2: Card
): ComparisonAxis {
  const v2Layouts = new Set(v2.pages.map((p) => p.layout));
  const v2Patterns = new Set(
    v2.pages
      .map((p) => p.infoPattern)
      .filter((x): x is NonNullable<typeof x> => !!x)
  );

  const v1Layouts = v1.stats.layoutsUsed.length;
  const v1Patterns = v1.stats.infoPatternsUsed.length;

  let v1Score: Score;
  if (v1Layouts + v1Patterns === 0) v1Score = "low";
  else if (v1Layouts + v1Patterns <= 4) v1Score = "low";
  else if (v1Layouts + v1Patterns <= 7) v1Score = "medium";
  else v1Score = "high";

  const v2Total = v2Layouts.size + v2Patterns.size;
  let v2Score: Score;
  if (v2Total <= 4) v2Score = "low";
  else if (v2Total <= 7) v2Score = "medium";
  else v2Score = "high";

  const evidence =
    `v2 uses ${v2Layouts.size} distinct layout(s) [${[...v2Layouts].join(", ")}] ` +
    `and ${v2Patterns.size} distinct infoPattern(s) [${[...v2Patterns].join(", ") || "none"}]. ` +
    `v1 baseline used ${v1Layouts} layout(s) [${v1.stats.layoutsUsed.join(", ")}] ` +
    `and ${v1Patterns} infoPattern(s).`;

  return {
    axis: "visual diversity",
    v1Score,
    v2Score,
    evidence,
  };
}

function buildSummary(
  v1: BaselineMeta,
  v2: Card,
  axes: ComparisonAxis[]
): string {
  const wins = axes.filter(
    (a) => scoreRank(a.v2Score) > scoreRank(a.v1Score)
  ).length;
  const ties = axes.filter(
    (a) => scoreRank(a.v2Score) === scoreRank(a.v1Score)
  ).length;
  const losses = axes.filter(
    (a) => scoreRank(a.v2Score) < scoreRank(a.v1Score)
  ).length;

  const claimCount = v2.claimLedger?.claims.length ?? 0;
  const arcSections = v2.narrativeArc
    ? Object.values(v2.narrativeArc).filter(
        (s) => typeof s === "string" && s.trim().length > 10
      ).length
    : 0;

  return (
    `v2 (${v2.id}) advances on ${wins} axis/axes, ties on ${ties}, regresses on ${losses} ` +
    `vs v1 (${v1.id}). The editorial pipeline produced ${claimCount} structured claim(s) ` +
    `and a ${arcSections}/6 narrative arc, neither of which existed in the v1 manual MVP. ` +
    `Visual diversity and rhetorical role variety should be inspected per-axis above.`
  );
}

function scoreRank(s: Score): number {
  switch (s) {
    case "n/a":
      return -1;
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
