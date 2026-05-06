#!/usr/bin/env bun
/**
 * M2.H — First v2 cardnews end-to-end CLI runner.
 *
 * Usage:
 *   bun run m2:first-v2 "<topic>" [--source-text <file>] [--series claude]
 *                                 [--preset c1-dark-lime] [--no-image]
 *
 * Env:
 *   ANTHROPIC_API_KEY  required
 *   CODEX_BIN          optional (default "codex")
 *
 * Pipeline:
 *   start (v2-editorial)         -> draft.claims-ready
 *   approve (writing)            -> draft.copy-ready  (or draft.review-blocked)
 *   manual image gen via codex   -> writes PNGs into the card images/ dir
 *   approve (imaging)            -> draft.images-ready
 *   approve (rendering stub)     -> exported
 *
 *   Then loads the canonical v1 baseline (`claude-code-three`) and writes
 *   a Markdown comparison report into the card directory.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { Pipeline } from "../src/core/orchestrator/pipeline";
import { FileStateStore } from "../src/providers-impl/file-state-store";
import { CodexImageProvider } from "../src/providers-impl/codex-image-provider";
import {
  FileSeriesRegistry,
  FilePresetRegistry,
} from "../src/core/registry";
import { makeClaudeAgentRunner } from "../src/integrations/llm/claude-agent-runner";
import { makeCodexAgentRunner } from "../src/integrations/llm/codex-agent-runner";
import {
  makeDualAgentRunner,
  type FallbackLatch,
} from "../src/integrations/llm/dual-agent-runner";
import {
  loadBaseline,
  compareToBaseline,
  renderComparisonReport,
} from "../src/integrations/llm/baseline-comparison";
import {
  AnalystInputSchema,
  AnalystOutputSchema,
  type AnalystInput,
  type AnalystOutput,
} from "../src/core/agents/contracts/analyst";
import {
  CopywriterPageInputSchema,
  CopywriterPageOutputSchema,
  type CopywriterPageInput,
  type CopywriterPageOutput,
} from "../src/core/agents/contracts/copywriter";
import {
  ImageDirectorInputSchema,
  ImageDirectorOutputSchema,
  type ImageDirectorInput,
  type ImageDirectorOutput,
} from "../src/core/agents/contracts/image-director";
import {
  FactCheckerInputSchema,
  FactCheckerOutputSchema,
  type FactCheckerInput,
  type FactCheckerOutput,
} from "../src/core/agents/contracts/fact-checker";
import type { SourcePolicy } from "../src/core/schemas/source-policy";

const TAG = "[m2-first-v2]";

interface Args {
  topic: string;
  sourceText?: string;
  series: string;
  preset: string;
  noImage: boolean;
  help: boolean;
}

const USAGE = `${TAG} Usage:
  bun run m2:first-v2 "<topic>" [options]

Options:
  --source-text <file>   Read source text from a file (UTF-8).
  --series <id>          Series id (default: claude).
  --preset <id>          Preset id (default: series.defaultPreset).
  --no-image             Skip image generation; stop at draft.copy-ready.
  --help                 Print this message.

Env:
  ANTHROPIC_API_KEY      required (real Claude API calls).
  CODEX_BIN              optional codex binary path (default "codex").
`;

function printUsage(): void {
  console.log(USAGE);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    topic: "",
    series: "claude",
    preset: "",
    noImage: false,
    help: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--no-image") {
      args.noImage = true;
    } else if (a === "--source-text") {
      args.sourceText = argv[++i];
    } else if (a === "--series") {
      args.series = argv[++i];
    } else if (a === "--preset") {
      args.preset = argv[++i];
    } else if (a.startsWith("--")) {
      throw new Error(`Unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }

  if (positional.length > 0) {
    args.topic = positional.join(" ");
  }

  return args;
}

async function checkCodexAvailable(codexBin: string): Promise<boolean> {
  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(codexBin, ["--version"]);
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    proc.on("error", () => settle(false));
    proc.on("close", (code) => settle(code === 0));
    setTimeout(() => settle(false), 5000);
  });
}

function todayId(topic: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug ? `${date}-${slug}` : `${date}-card`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`
    );
    printUsage();
    process.exit(1);
    return;
  }

  if (args.help || !args.topic) {
    if (!args.help) {
      console.error(`${TAG} A topic argument is required.`);
    }
    printUsage();
    process.exit(args.help ? 0 : 1);
    return;
  }

  // ---- Pre-flight checks ----
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${TAG} ANTHROPIC_API_KEY not set.

This script runs real Claude API calls. Set the env var:
  export ANTHROPIC_API_KEY=sk-ant-...

Then re-run.`);
    process.exit(1);
    return;
  }

  const codexBin = process.env.CODEX_BIN ?? "codex";
  if (!args.noImage) {
    const ok = await checkCodexAvailable(codexBin);
    if (!ok) {
      console.error(
        `${TAG} codex CLI not found at "${codexBin}". Install via \`brew install codex\` and run \`codex login\`, or pass --no-image to skip image generation.`
      );
      process.exit(1);
      return;
    }
  }

  // ---- Resolve repo paths ----
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const dataDir = path.join(projectRoot, "data");
  const seriesRegistry = new FileSeriesRegistry(dataDir);
  const presetRegistry = new FilePresetRegistry(dataDir);

  console.log(`${TAG} loading series ${args.series} ...`);
  const series = await seriesRegistry.load(args.series);

  const presetId = args.preset || series.defaultPreset;
  console.log(`${TAG} loading preset ${presetId} ...`);
  const preset = await presetRegistry.load(presetId);

  // Optional source text
  let sourceText: string | undefined;
  if (args.sourceText) {
    sourceText = await fs.readFile(args.sourceText, "utf8");
    console.log(
      `${TAG} loaded sourceText from ${args.sourceText} (${sourceText.length} chars)`
    );
  }

  // ---- Build state store at the per-series cards dir ----
  const cardsDir = path.join(dataDir, "series", series.id, "cards");
  await fs.mkdir(cardsDir, { recursive: true });
  const stateStore = new FileStateStore(cardsDir);

  // ---- Cost warning + countdown ----
  console.log(
    `${TAG} About to run real Claude API + codex image gen. Continue in 3s (Ctrl+C to abort)...`
  );
  await sleep(3000);

  // ---- Predict card id so we can pre-create the dir for token logs ----
  // The Pipeline default idGen returns `card-${Date.now()}`, but we want a
  // human-friendly path under data/series/<series>/cards/<id>/. We pass a
  // custom idGen.
  const cardId = todayId(args.topic);
  const cardDir = path.join(cardsDir, cardId);
  await fs.mkdir(cardDir, { recursive: true });

  // ---- Build real agent runners (Claude primary, Codex fallback) ----
  const tokenLogPath = cardDir; // .tokens.jsonl appended here
  const fallbackLatch: FallbackLatch = { tripped: false };

  const analyst = makeDualAgentRunner<AnalystInput, AnalystOutput>({
    claude: makeClaudeAgentRunner<AnalystInput, AnalystOutput>({
      contract: {
        inputSchema: AnalystInputSchema,
        outputSchema: AnalystOutputSchema,
        systemPromptPath: "data/agents/analyst.md",
      },
      name: "analyst",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<AnalystInput, AnalystOutput>({
      contract: {
        inputSchema: AnalystInputSchema,
        outputSchema: AnalystOutputSchema,
        systemPromptPath: "data/agents/analyst.md",
      },
      name: "analyst",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const copywriter = makeDualAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
    claude: makeClaudeAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
      contract: {
        inputSchema: CopywriterPageInputSchema,
        outputSchema: CopywriterPageOutputSchema,
        systemPromptPath: "data/agents/copywriter.md",
      },
      name: "copywriter",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
      contract: {
        inputSchema: CopywriterPageInputSchema,
        outputSchema: CopywriterPageOutputSchema,
        systemPromptPath: "data/agents/copywriter.md",
      },
      name: "copywriter",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const imageDirector = makeDualAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
    claude: makeClaudeAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
      contract: {
        inputSchema: ImageDirectorInputSchema,
        outputSchema: ImageDirectorOutputSchema,
        systemPromptPath: "data/agents/image-director.md",
      },
      name: "image-director",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
      contract: {
        inputSchema: ImageDirectorInputSchema,
        outputSchema: ImageDirectorOutputSchema,
        systemPromptPath: "data/agents/image-director.md",
      },
      name: "image-director",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const factChecker = makeDualAgentRunner<FactCheckerInput, FactCheckerOutput>({
    claude: makeClaudeAgentRunner<FactCheckerInput, FactCheckerOutput>({
      contract: {
        inputSchema: FactCheckerInputSchema,
        outputSchema: FactCheckerOutputSchema,
        systemPromptPath: "data/agents/fact-checker.md",
      },
      name: "fact-checker",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<FactCheckerInput, FactCheckerOutput>({
      contract: {
        inputSchema: FactCheckerInputSchema,
        outputSchema: FactCheckerOutputSchema,
        systemPromptPath: "data/agents/fact-checker.md",
      },
      name: "fact-checker",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  // ---- Build pipeline ----
  const pipeline = new Pipeline({
    stateStore,
    analyst,
    copywriter,
    imageDirector,
    factChecker,
    idGen: () => cardId,
  });

  // ---- Source policy ----
  // M2.H default: skip fact-check (the v2 Analyst extracts the ledger from the
  // model's own knowledge / sourceText). Users can later wire in a policy
  // file once that contract is finalized.
  const sourcePolicy: SourcePolicy = {
    trustLevel: sourceText ? "user-provided" : "unknown",
    factCheckMode: "skip",
  };

  // ---- 1. Start pipeline (Analyst v2) ----
  console.log(`${TAG} pipeline.start ...`);
  const card0 = await pipeline.start({
    series,
    preset,
    topic: args.topic,
    sourceText,
    sourcePolicy,
    pipelineVersion: "v2-editorial",
  });
  console.log(`${TAG} start              -> status=${card0.status} id=${card0.id}`);
  if (card0.status === "draft.failed") {
    console.error(`${TAG} Analyst stage failed:`);
    for (const v of card0.violations ?? []) {
      console.error(`  - [${v.code}] ${v.message}`);
    }
    process.exit(2);
    return;
  }
  printClaimLedgerSummary(card0);
  console.log(`${TAG} pages: ${card0.pages.length}`);

  // ---- 2. Approve into copywriting ----
  console.log(`${TAG} pipeline.approve (writing) ...`);
  let card1 = await pipeline.approve(card0.id);
  console.log(`${TAG} approve(writing)    -> status=${card1.status}`);
  if (card1.status === "draft.review-blocked") {
    console.warn(
      `${TAG} review blocked. Violations:`
    );
    for (const v of card1.violations ?? []) {
      console.warn(`  - [${v.code}] ${v.message}`);
    }
    console.warn(
      `${TAG} Auto-forcing past review-blocked (M2.H is autonomous; M4 will offer interactive recovery).`
    );
    card1 = await pipeline.forceAdvanceFromReviewBlocked(card0.id);
    console.log(`${TAG} forceAdvance         -> status=${card1.status}`);
  } else if (card1.status === "draft.failed") {
    console.error(`${TAG} Copywriter stage failed:`);
    for (const v of card1.violations ?? []) {
      console.error(`  - [${v.code}] ${v.message}`);
    }
    process.exit(2);
    return;
  }

  // ---- 3. Image generation (or skip) ----
  if (args.noImage) {
    console.log(`${TAG} --no-image set; stopping at status=${card1.status}`);
    await emitComparison(projectRoot, card1, cardDir);
    finalReport(cardDir, /*images*/ 0);
    return;
  }

  // Approve to imaging stage; the orchestrator records prompts per page.
  console.log(`${TAG} pipeline.approve (imaging) — orchestrator records prompts ...`);
  const card2 = await pipeline.approve(card0.id);
  console.log(`${TAG} approve(imaging)    -> status=${card2.status}`);
  if (card2.status === "draft.failed") {
    console.error(`${TAG} ImageDirector stage failed:`);
    for (const v of card2.violations ?? []) {
      console.error(`  - [${v.code}] ${v.message}`);
    }
    process.exit(2);
    return;
  }

  // ---- 4. Real image generation via CodexImageProvider ----
  // (M2.H temporary integration — M3 will move this into the pipeline.)
  const imagesDir = path.join(cardDir, "images");
  await fs.mkdir(imagesDir, { recursive: true });

  let imagesGenerated = 0;
  const updatedPages = [...card2.pages];
  for (let i = 0; i < updatedPages.length; i++) {
    const page = updatedPages[i];
    if (!page.image || !page.image.prompt) continue;

    const filename = `page-${page.index.toString().padStart(2, "0")}-${page.role}`;
    const provider = new CodexImageProvider({
      repoRoot: projectRoot,
      outDir: imagesDir,
      filename,
      codexBin,
    });

    console.log(
      `${TAG} codex-image  page=${page.index} layout=${page.layout} ...`
    );
    try {
      const asset = await provider.generate(page.image.prompt);
      // Update page.image.path to the actual saved location (relative).
      const rel = path.relative(projectRoot, asset.path);
      updatedPages[i] = {
        ...page,
        image: {
          ...page.image,
          path: rel,
          providerMeta: asset.providerMeta,
        },
      };
      imagesGenerated += 1;
      console.log(`${TAG}   -> ${rel}`);
    } catch (err) {
      console.error(
        `${TAG}   FAILED page=${page.index}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Write the updated card with real image paths back to state.
  const card3Pre = { ...card2, pages: updatedPages };
  await stateStore.write(card2.id, card3Pre);

  // ---- 5. Approve to exported (M1 stub transition) ----
  console.log(`${TAG} pipeline.approve (rendering stub) ...`);
  const card4 = await pipeline.approve(card0.id);
  console.log(`${TAG} approve(rendering)  -> status=${card4.status}`);

  // ---- 6. Comparison report ----
  await emitComparison(projectRoot, card4, cardDir);

  finalReport(cardDir, imagesGenerated);
}

function printClaimLedgerSummary(card: {
  claimLedger?: { claims: Array<{ type: string; confidence: string }> };
}): void {
  const claims = card.claimLedger?.claims ?? [];
  if (claims.length === 0) {
    console.log(`${TAG} claim ledger: (none)`);
    return;
  }
  const byType = new Map<string, number>();
  const byConf = new Map<string, number>();
  for (const c of claims) {
    byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
    byConf.set(c.confidence, (byConf.get(c.confidence) ?? 0) + 1);
  }
  console.log(`${TAG} claim ledger: ${claims.length} claim(s)`);
  console.log(
    `${TAG}   by type:        ${[...byType.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`
  );
  console.log(
    `${TAG}   by confidence:  ${[...byConf.entries()].map(([k, v]) => `${k}=${v}`).join(", ")}`
  );
}

async function emitComparison(
  projectRoot: string,
  v2Card: Parameters<typeof compareToBaseline>[1],
  cardDir: string
): Promise<void> {
  const baselinePath = path.join(
    projectRoot,
    "data/series/claude/cards/2026-05-01-claude-code-three/baseline.json"
  );
  try {
    const v1 = await loadBaseline(baselinePath);
    const cmp = compareToBaseline(v1, v2Card);
    const md = renderComparisonReport(cmp);
    const outPath = path.join(cardDir, "comparison-vs-v1.md");
    await fs.writeFile(outPath, md, "utf8");
    console.log(`${TAG} wrote comparison: ${outPath}`);
  } catch (err) {
    console.warn(
      `${TAG} comparison generation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function finalReport(cardDir: string, imagesGenerated: number): void {
  console.log(`${TAG} DONE`);
  console.log(`${TAG} state.json: ${path.join(cardDir, "state.json")}`);
  console.log(
    `${TAG} images:     ${path.join(cardDir, "images")}  (${imagesGenerated} PNG${imagesGenerated === 1 ? "" : "s"})`
  );
  console.log(
    `${TAG} tokens:     ${path.join(cardDir, ".tokens.jsonl")}`
  );
  console.log(
    `${TAG} comparison: ${path.join(cardDir, "comparison-vs-v1.md")}`
  );
}

main().catch((err) => {
  console.error(
    `${TAG} FATAL: ${err instanceof Error ? err.message : String(err)}`
  );
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
