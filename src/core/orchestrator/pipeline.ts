import * as path from "node:path";
import type { StateStore } from "../providers/state";
import type { AgentPort } from "../agents/ports";
import type {
  AnalystInput,
  AnalystOutput,
} from "../agents/contracts/analyst";
import type {
  CopywriterPageInput,
  CopywriterPageOutput,
  CopyContext,
} from "../agents/contracts/copywriter";
import type {
  ImageDirectorInput,
  ImageDirectorOutput,
} from "../agents/contracts/image-director";
import type {
  FactCheckerInput,
  FactCheckerOutput,
} from "../agents/contracts/fact-checker";
import { CardSchema, type Card, type Violation } from "../schemas/card";
import type { Page } from "../schemas/page";
import type { Series } from "../schemas/series";
import type { Preset } from "../schemas/preset";
import type { SourcePolicy } from "../schemas/source-policy";
import type { CardStatus } from "../schemas/card-status";
import { validateStructure } from "../validators/structure";
import { validateDensity } from "../validators/density";
import { validateContext } from "../validators/context";
import { validateEditorial } from "../validators/editorial";
import { merge, ok, fail } from "../validators/types";
import { withRetry } from "./retry";
import { describeApprove } from "./approve";
import type {
  ExportConfig,
  ExportResult,
} from "../../exporters/png";

export type ExporterFn = (config: ExportConfig) => Promise<ExportResult>;

export interface PipelineDeps {
  stateStore: StateStore;
  analyst: AgentPort<AnalystInput, AnalystOutput>;
  copywriter: AgentPort<CopywriterPageInput, CopywriterPageOutput>;
  imageDirector: AgentPort<ImageDirectorInput, ImageDirectorOutput>;
  factChecker: AgentPort<FactCheckerInput, FactCheckerOutput>;
  /**
   * PNG exporter. Defaults to the real Puppeteer-backed exportCard at module
   * level — tests inject a mock to avoid launching Chrome.
   */
  exporter?: ExporterFn;
  /**
   * Output directory root for PNG exports. Card export lands at
   * `<exportRoot>/<series>/<cardId>/`. Defaults to "data/exports".
   */
  exportRoot?: string;
  now?: () => string;
  idGen?: () => string;
}

export interface StartArgs {
  series: Series;
  preset: Preset;
  topic?: string;
  sourceText?: string;
  sourcePolicy: SourcePolicy;
  pipelineVersion?: "v1-mocked" | "v2-editorial";
}

const MAX_ATTEMPTS = 3;
const LIST_LAYOUTS = new Set(["P3", "P5"]);

interface AnalystOutlinePage {
  index: number;
  role: "cover" | "body" | "cta";
  layout: AnalystOutput["pages"][number]["layout"];
  workingTitle: string;
  message: string;
  mappingNote: string;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultIdGen(): string {
  return `card-${Date.now()}`;
}

function pageNumPad(n: number): string {
  return n.toString().padStart(2, "0");
}

function buildAnalystInput(args: StartArgs, factCheck?: FactCheckerOutput): AnalystInput {
  const { series, preset, topic, sourceText, sourcePolicy } = args;
  const grouped = factCheck
    ? {
        confirmed: factCheck.claims
          .filter((c) => c.status === "confirmed")
          .map((c) => c.claim),
        uncertain: factCheck.claims
          .filter((c) => c.status === "uncertain")
          .map((c) => c.claim),
        conflicting: factCheck.claims
          .filter((c) => c.status === "conflicting")
          .map((c) => c.claim),
      }
    : undefined;

  return {
    series: {
      id: series.id,
      name: series.name,
      theme: series.theme,
      audience: series.audience,
      tone: series.tone,
      branding: { seriesTag: series.branding.seriesTag },
      footerHandle: series.footerHandle,
    },
    preset: { id: preset.id, layouts: preset.layouts },
    topic,
    sourceText,
    sourcePolicy,
    factCheck: grouped,
  };
}

function buildPagesFromAnalyst(out: AnalystOutput): Page[] {
  return out.pages.map((p) => ({
    index: p.index,
    role: p.role,
    layout: p.layout,
    message: p.message,
    mappingNote: p.mappingNote,
    copy: { title: p.workingTitle },
    manualEdit: false,
  }));
}

function buildV2PagesFromAnalyst(out: AnalystOutput): Page[] {
  return out.pages.map((p) => ({
    index: p.index,
    role: p.role,
    layout: p.layout,
    message: p.message,
    mappingNote: p.mappingNote,
    copyIntent: p.copyIntent,
    claims: p.claims ?? [],
    infoPattern: p.infoPattern,
    copy: { title: p.workingTitle },
    manualEdit: false,
  }));
}

function buildFailedShellPages(): Page[] {
  return [
    {
      index: 1,
      role: "cover",
      layout: "cover",
      message: "failed shell cover",
      mappingNote: "shell mapping",
      copy: { title: "Failed" },
      manualEdit: false,
    },
    {
      index: 2,
      role: "body",
      layout: "P1",
      message: "failed shell body 1",
      mappingNote: "shell body 1 mapping",
      copy: { title: "Body 1" },
      manualEdit: false,
    },
    {
      index: 3,
      role: "body",
      layout: "P2",
      message: "failed shell body 2",
      mappingNote: "shell body 2 mapping",
      copy: { title: "Body 2" },
      manualEdit: false,
    },
    {
      index: 4,
      role: "cta",
      layout: "cta",
      message: "failed shell cta",
      mappingNote: "shell cta mapping",
      copy: { title: "CTA" },
      manualEdit: false,
    },
  ];
}

/**
 * Lazy default exporter: only requires puppeteer-core when the user actually
 * approves a render. Avoids loading Chromium for test pipelines that mock the
 * exporter.
 */
async function defaultExporter(config: ExportConfig): Promise<ExportResult> {
  const mod = await import("../../exporters/png");
  return mod.exportCard(config);
}

const MAX_RENDER_RETRIES = 3;

export class Pipeline {
  private readonly deps: PipelineDeps;
  private readonly now: () => string;
  private readonly idGen: () => string;
  private readonly exporter: ExporterFn;
  private readonly exportRoot: string;
  /**
   * In-memory cache of the Series/Preset that started each card. Required
   * because the Card on disk stores only string IDs; the renderer needs the
   * fully-resolved objects. A future M3.G will swap this for a registry.
   */
  private readonly seriesByCardId = new Map<string, Series>();
  private readonly presetByCardId = new Map<string, Preset>();

  constructor(deps: PipelineDeps) {
    this.deps = deps;
    this.now = deps.now ?? defaultNow;
    this.idGen = deps.idGen ?? defaultIdGen;
    this.exporter = deps.exporter ?? defaultExporter;
    this.exportRoot = deps.exportRoot ?? "data/exports";
  }

  async start(args: StartArgs): Promise<Card> {
    const requestedVersion = args.pipelineVersion ?? "v1-mocked";
    if (requestedVersion === "v2-editorial") {
      return this.startV2(args);
    }

    const id = this.idGen();
    this.seriesByCardId.set(id, args.series);
    this.presetByCardId.set(id, args.preset);
    const createdAt = this.now();

    let factCheck: FactCheckerOutput | undefined;
    if (args.sourcePolicy.factCheckMode !== "skip") {
      factCheck = await this.deps.factChecker.run({
        topic: args.topic,
        sourceText: args.sourceText,
        sourcePolicy: args.sourcePolicy,
      });
    }

    const analystInput = buildAnalystInput(args, factCheck);
    const sourceTextLength = (args.sourceText ?? args.topic ?? "").length;

    const retry = await withRetry<AnalystOutput>({
      fn: () => this.deps.analyst.run(analystInput),
      validate: (out) => {
        const candidate = this.assembleCardForValidation({
          id,
          args,
          analyst: out,
          createdAt,
        });
        return validateStructure(candidate, { sourceTextLength });
      },
      maxAttempts: MAX_ATTEMPTS,
    });

    if (!retry.ok || !retry.value) {
      const failed = this.buildFailedCard({
        id,
        args,
        createdAt,
        failedStage: "analyst",
        violations: retry.violations,
      });
      await this.deps.stateStore.withLock(id, async () => {
        await this.deps.stateStore.write(id, failed);
      });
      return failed;
    }

    const analystOut = retry.value;
    const pages = buildPagesFromAnalyst(analystOut);
    const card: Card = CardSchema.parse({
      id,
      series: args.series.id,
      preset: args.preset.id,
      pipelineVersion: "v1-mocked",
      topic: args.topic,
      sourceText: args.sourceText,
      sourcePolicy: args.sourcePolicy,
      coreMessage: analystOut.coreMessage,
      pages,
      status: "draft.outline-ready" as CardStatus,
      attempts: [],
      createdAt,
      updatedAt: this.now(),
    });

    await this.deps.stateStore.withLock(id, async () => {
      await this.deps.stateStore.write(id, card);
    });
    return card;
  }

  private async startV2(args: StartArgs): Promise<Card> {
    const id = this.idGen();
    this.seriesByCardId.set(id, args.series);
    this.presetByCardId.set(id, args.preset);
    const createdAt = this.now();

    // Step 0: optional fact-check (same as v1).
    let factCheck: FactCheckerOutput | undefined;
    if (args.sourcePolicy.factCheckMode !== "skip") {
      factCheck = await this.deps.factChecker.run({
        topic: args.topic,
        sourceText: args.sourceText,
        sourcePolicy: args.sourcePolicy,
      });
    }

    // Step 1: Analyst v2 — emits Claim Ledger + thesis + arc + pages.
    // Schema parsing inside the runner does the heavy lifting; we additionally
    // assemble the candidate card to exercise the v2 superRefine
    // (claim referential integrity, copyIntent presence, page-role positions).
    const analystInput = buildAnalystInput(args, factCheck);

    const retry = await withRetry<AnalystOutput>({
      fn: () => this.deps.analyst.run(analystInput),
      validate: (out) => {
        try {
          this.assembleV2CardForValidation({
            id,
            args,
            analyst: out,
            createdAt,
          });
          return ok();
        } catch (err) {
          return fail([
            {
              level: "L1",
              code: "ANALYST/V2_SHAPE",
              message:
                err instanceof Error ? err.message : String(err),
            },
          ]);
        }
      },
      maxAttempts: MAX_ATTEMPTS,
    });

    if (!retry.ok || !retry.value) {
      const failed = this.buildFailedCard({
        id,
        args,
        createdAt,
        failedStage: "analyst",
        violations: retry.violations,
      });
      await this.deps.stateStore.withLock(id, async () => {
        await this.deps.stateStore.write(id, failed);
      });
      return failed;
    }

    const analystOut = retry.value;
    const card = this.buildV2CardFromAnalyst({
      id,
      args,
      analyst: analystOut,
      createdAt,
    });

    await this.deps.stateStore.withLock(id, async () => {
      await this.deps.stateStore.write(id, card);
    });
    return card;
  }

  /**
   * v2-editorial recover path: user has reviewed the violations on a
   * draft.review-blocked card and chosen to force-proceed. Move directly
   * to draft.copy-ready so approve() can advance to imaging.
   */
  async forceAdvanceFromReviewBlocked(cardId: string): Promise<Card> {
    return this.deps.stateStore.withLock(cardId, async () => {
      const current = await this.deps.stateStore.read(cardId);
      if (!current) {
        throw new Error(`card not found: ${cardId}`);
      }
      if (current.status !== "draft.review-blocked") {
        throw new Error(
          `forceAdvanceFromReviewBlocked requires draft.review-blocked, got ${current.status}`
        );
      }
      const advanced: Card = CardSchema.parse({
        ...current,
        status: "draft.copy-ready",
        // keep violations[] for audit trail; clear recoverOptions since the
        // user has made their choice.
        recoverOptions: undefined,
        updatedAt: this.now(),
      });
      await this.deps.stateStore.write(cardId, advanced);
      return advanced;
    });
  }

  async approve(cardId: string): Promise<Card> {
    const current = await this.deps.stateStore.read(cardId);
    if (!current) {
      throw new Error(`card not found: ${cardId}`);
    }

    const decision = describeApprove(current.status);
    if (decision.action === "notice" || decision.action === "recover") {
      return current;
    }

    switch (decision.next) {
      case "draft.writing":
        return this.runCopywriter(current);
      case "draft.imaging":
        return this.runImageDirector(current);
      case "draft.rendering":
        return this.runRenderAndExport(current);
      default:
        return current;
    }
  }

  async resume(cardId: string): Promise<Card> {
    const card = await this.deps.stateStore.read(cardId);
    if (!card) {
      throw new Error(`card not found: ${cardId}`);
    }
    return card;
  }

  // --- private helpers -----------------------------------------------------

  private assembleCardForValidation(args: {
    id: string;
    args: StartArgs;
    analyst: AnalystOutput;
    createdAt: string;
  }): Card {
    const pages = buildPagesFromAnalyst(args.analyst);
    return CardSchema.parse({
      id: args.id,
      series: args.args.series.id,
      preset: args.args.preset.id,
      pipelineVersion: "v1-mocked",
      topic: args.args.topic,
      sourceText: args.args.sourceText,
      sourcePolicy: args.args.sourcePolicy,
      coreMessage: args.analyst.coreMessage,
      pages,
      status: "draft.analyzing" as CardStatus,
      attempts: [],
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  }

  private assembleV2CardForValidation(args: {
    id: string;
    args: StartArgs;
    analyst: AnalystOutput;
    createdAt: string;
  }): Card {
    const pages = buildV2PagesFromAnalyst(args.analyst);
    return CardSchema.parse({
      id: args.id,
      series: args.args.series.id,
      preset: args.args.preset.id,
      pipelineVersion: "v2-editorial",
      topic: args.args.topic,
      sourceText: args.args.sourceText,
      sourcePolicy: args.args.sourcePolicy,
      coreMessage: args.analyst.thesis,
      thesis: args.analyst.thesis,
      audienceQuestion: args.analyst.audienceQuestion,
      narrativeArc: args.analyst.narrativeArc,
      claimLedger: args.analyst.claimLedger,
      pages,
      status: "draft.claim-extracting" as CardStatus,
      attempts: [],
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  }

  private buildV2CardFromAnalyst(args: {
    id: string;
    args: StartArgs;
    analyst: AnalystOutput;
    createdAt: string;
  }): Card {
    const pages = buildV2PagesFromAnalyst(args.analyst);
    return CardSchema.parse({
      id: args.id,
      series: args.args.series.id,
      preset: args.args.preset.id,
      pipelineVersion: "v2-editorial",
      topic: args.args.topic,
      sourceText: args.args.sourceText,
      sourcePolicy: args.args.sourcePolicy,
      coreMessage: args.analyst.thesis,
      thesis: args.analyst.thesis,
      audienceQuestion: args.analyst.audienceQuestion,
      narrativeArc: args.analyst.narrativeArc,
      claimLedger: args.analyst.claimLedger,
      pages,
      status: "draft.claims-ready" as CardStatus,
      attempts: [],
      createdAt: args.createdAt,
      updatedAt: this.now(),
    });
  }

  private buildFailedCard(args: {
    id: string;
    args: StartArgs;
    createdAt: string;
    failedStage: "analyst" | "copywriter" | "image-director";
    violations: Violation[];
    base?: Card;
  }): Card {
    const updatedAt = this.now();
    const pages = args.base ? args.base.pages : buildFailedShellPages();
    return CardSchema.parse({
      id: args.id,
      series: args.args.series.id,
      preset: args.args.preset.id,
      pipelineVersion: "v1-mocked",
      topic: args.args.topic,
      sourceText: args.args.sourceText,
      sourcePolicy: args.args.sourcePolicy,
      coreMessage: args.base?.coreMessage ?? "failed shell core message",
      pages,
      status: "draft.failed" as CardStatus,
      failedStage: args.failedStage,
      violations: args.violations,
      recoverOptions: {
        forceProceed: false,
        manualEdit: true,
        restart: true,
      },
      attempts: args.base?.attempts ?? [],
      createdAt: args.createdAt,
      updatedAt,
    });
  }

  private async runCopywriter(card: Card): Promise<Card> {
    return this.deps.stateStore.withLock(card.id, async () => {
      const writingCard: Card = {
        ...card,
        status: "draft.writing",
        updatedAt: this.now(),
      };
      await this.deps.stateStore.write(card.id, writingCard);

      const isV2 = writingCard.pipelineVersion === "v2-editorial";

      // For v2, we wrap the per-page copywriter loop in withRetry against the
      // Editorial Review check (up to 3 attempts). Each retry re-runs all body
      // pages with the prior violations attached so the Copywriter can fix.
      // For v1, no editorial review — single pass through the loop.
      let priorViolations: Violation[] = [];
      let attempts = 0;
      const maxEditorialAttempts = isV2 ? MAX_ATTEMPTS : 1;

      while (attempts < maxEditorialAttempts) {
        attempts++;
        const loopResult = await this.runCopywriterLoop(writingCard, {
          fixViolations: priorViolations,
        });

        if (loopResult.kind === "failed") {
          const failed = this.buildFailedCardFromCard({
            base: writingCard,
            failedStage: "copywriter",
            violations: loopResult.violations,
          });
          await this.deps.stateStore.write(card.id, failed);
          return failed;
        }

        const candidate: Card = CardSchema.parse({
          ...writingCard,
          pages: loopResult.pages,
          status: "draft.copy-ready",
          updatedAt: this.now(),
        });

        if (!isV2) {
          await this.deps.stateStore.write(card.id, candidate);
          return candidate;
        }

        // v2: run Editorial Review.
        const review = await validateEditorial(candidate);
        if (review.ok) {
          await this.deps.stateStore.write(card.id, candidate);
          return candidate;
        }

        priorViolations = review.violations;
        // Loop again unless we're out of attempts.
      }

      // Editorial Review still failing after MAX_ATTEMPTS — transition to
      // draft.review-blocked so the user can decide (force / manual / restart).
      const blocked: Card = CardSchema.parse({
        ...writingCard,
        // Persist the latest copy so the user sees what's blocked.
        pages: writingCard.pages,
        status: "draft.review-blocked",
        violations: priorViolations,
        recoverOptions: {
          forceProceed: true,
          manualEdit: true,
          restart: true,
        },
        updatedAt: this.now(),
      });
      await this.deps.stateStore.write(card.id, blocked);
      return blocked;
    });
  }

  /**
   * Single pass of the per-page Copywriter loop. Returns either the updated
   * pages (success) or the violations (failure) — does NOT touch the state
   * store. Caller is responsible for transitioning the Card.
   */
  private async runCopywriterLoop(
    writingCard: Card,
    opts: {
      fixViolations: Violation[];
      /**
       * If provided, only re-run Copywriter for body pages whose `index` is in
       * this set. Other pages keep their existing copy. Used by the L2 render
       * rollback path to fix only the overflowing pages.
       */
      onlyPageIndices?: Set<number>;
    }
  ): Promise<
    | { kind: "ok"; pages: Page[] }
    | { kind: "failed"; violations: Violation[] }
  > {
    const isV2 = writingCard.pipelineVersion === "v2-editorial";
    const ledgerById = new Map(
      writingCard.claimLedger?.claims.map((c) => [c.id, c]) ?? []
    );

    const copyContext: CopyContext = {
      tone: "default",
      recurringTerms: [],
      usedExamples: [],
      forbiddenRepeats: [],
    };

    const updatedPages: Page[] = [...writingCard.pages];

    for (let i = 0; i < updatedPages.length; i++) {
      const page = updatedPages[i];
      if (page.role !== "body") continue;
      if (opts.onlyPageIndices && !opts.onlyPageIndices.has(page.index)) {
        continue;
      }

      const pageClaimIds = page.claims ?? [];
      const ledgerSlice = isV2
        ? pageClaimIds
            .map((cid) => ledgerById.get(cid))
            .filter((c): c is NonNullable<typeof c> => c !== undefined)
        : undefined;

      const input: CopywriterPageInput = {
        series: {
          name: writingCard.series,
          audience: "",
          tone: copyContext.tone,
          branding: { seriesTag: "" },
        },
        outline: writingCard.coreMessage,
        page: {
          index: page.index,
          role: page.role,
          layout: page.layout,
          workingTitle: page.copy.title,
          message: page.message,
          mappingNote: page.mappingNote,
          copyIntent: page.copyIntent,
          claims: pageClaimIds,
          infoPattern: page.infoPattern,
        },
        ledgerSlice,
        copyContext,
        fixViolations:
          opts.fixViolations.length > 0 ? opts.fixViolations : undefined,
      };

      const retry = await withRetry<CopywriterPageOutput>({
        fn: () => this.deps.copywriter.run(input),
        validate: (out) => {
          const candidate: Page = { ...page, copy: out.copy };
          return merge(
            validateDensity({ pages: [candidate] }),
            validateContext({ pages: [candidate] })
          );
        },
        maxAttempts: MAX_ATTEMPTS,
      });

      if (!retry.ok || !retry.value) {
        return { kind: "failed", violations: retry.violations };
      }

      updatedPages[i] = { ...page, copy: retry.value.copy };
    }

    return { kind: "ok", pages: updatedPages };
  }

  private async runImageDirector(card: Card): Promise<Card> {
    return this.deps.stateStore.withLock(card.id, async () => {
      const imagingCard: Card = {
        ...card,
        status: "draft.imaging",
        updatedAt: this.now(),
      };
      await this.deps.stateStore.write(card.id, imagingCard);

      const updatedPages: Page[] = [];
      for (const page of imagingCard.pages) {
        if (page.role !== "body") {
          updatedPages.push(page);
          continue;
        }
        if (LIST_LAYOUTS.has(page.layout)) {
          updatedPages.push(page);
          continue;
        }

        const out = await this.deps.imageDirector.run({
          preset: { imageStyle: "neon" }, // M1: only path/prompt persisted; style not load-bearing
          page: {
            index: page.index,
            layout: page.layout,
            purpose: page.message,
            title: page.copy.title,
          },
        });

        if (out.skipReason) {
          updatedPages.push(page);
          continue;
        }

        const fileName = `page-${pageNumPad(page.index)}.png`;
        const imagePath = `data/series/${card.series}/cards/${card.id}/images/${fileName}`;
        updatedPages.push({
          ...page,
          image: {
            path: imagePath,
            prompt: out.prompt,
            manualOverride: false,
          },
        });
      }

      const ready: Card = CardSchema.parse({
        ...imagingCard,
        pages: updatedPages,
        status: "draft.images-ready",
        updatedAt: this.now(),
      });
      await this.deps.stateStore.write(card.id, ready);
      return ready;
    });
  }

  /**
   * M3.E: full render + export with L2 measurement rollback.
   *
   * Flow:
   *   1. Resolve preset/series from the in-memory cache (set during start()).
   *   2. Status → draft.rendering, persist.
   *   3. Call exporter; collect L2 violations.
   *   4. If no violations: status → exported, persist, return.
   *   5. Otherwise: rewrite the affected pages via Copywriter (passing
   *      `fixViolations`), re-run ImageDirector for those pages, recurse into
   *      step 3. Bounded by MAX_RENDER_RETRIES (3).
   *   6. After exhausting retries: write as draft.failed with the final L2
   *      violations attached.
   */
  private async runRenderAndExport(card: Card): Promise<Card> {
    const series = this.seriesByCardId.get(card.id);
    const preset = this.presetByCardId.get(card.id);
    if (!series || !preset) {
      throw new Error(
        `Pipeline.runRenderAndExport: series/preset not registered for card ${card.id}. start() must be called on the same Pipeline instance.`
      );
    }

    let working = card;

    for (let attempt = 0; attempt < MAX_RENDER_RETRIES; attempt++) {
      // Transition into draft.rendering.
      working = await this.deps.stateStore.withLock(working.id, async () => {
        const next: Card = {
          ...working,
          status: "draft.rendering",
          updatedAt: this.now(),
        };
        await this.deps.stateStore.write(next.id, next);
        return next;
      });

      const outDir = path.posix.join(
        this.exportRoot,
        series.id,
        working.id
      );
      const result = await this.exporter({
        card: working,
        preset,
        series,
        outDir,
      });

      if (result.l2Violations.length === 0) {
        // Success — atomic swap already done by the exporter.
        return this.deps.stateStore.withLock(working.id, async () => {
          const exported: Card = CardSchema.parse({
            ...working,
            status: "exported",
            updatedAt: this.now(),
          });
          await this.deps.stateStore.write(exported.id, exported);
          return exported;
        });
      }

      // L2 violations: roll back the affected pages through Copywriter +
      // ImageDirector and try again.
      const violationViolations: Violation[] = result.l2Violations.map((v) => ({
        level: "L2" as const,
        code: v.code,
        message: v.message,
        pageIndex: v.pageIndex,
        field: v.field,
      }));
      const affectedPageIndices = new Set(
        result.l2Violations.map((v) => v.pageIndex)
      );

      // Status → draft.writing, persist with violations attached for visibility.
      working = await this.deps.stateStore.withLock(working.id, async () => {
        const next: Card = {
          ...working,
          status: "draft.writing",
          violations: violationViolations,
          updatedAt: this.now(),
        };
        await this.deps.stateStore.write(next.id, next);
        return next;
      });

      // Re-run Copywriter only for the affected body pages.
      const rewriteResult = await this.runCopywriterLoop(working, {
        fixViolations: violationViolations,
        onlyPageIndices: affectedPageIndices,
      });
      if (rewriteResult.kind === "failed") {
        const failed = this.buildFailedCardFromCard({
          base: working,
          failedStage: "copywriter",
          violations: rewriteResult.violations,
        });
        await this.deps.stateStore.withLock(working.id, async () => {
          await this.deps.stateStore.write(failed.id, failed);
        });
        return failed;
      }

      working = await this.deps.stateStore.withLock(working.id, async () => {
        const next: Card = CardSchema.parse({
          ...working,
          pages: rewriteResult.pages,
          status: "draft.copy-ready",
          updatedAt: this.now(),
        });
        await this.deps.stateStore.write(next.id, next);
        return next;
      });

      // Re-run ImageDirector for the affected pages so any image regen happens
      // before the next export attempt. Going through the standard transition
      // (draft.imaging → draft.images-ready) keeps the status machine honest.
      working = await this.runImageDirector(working);

      // Loop: next iteration retries the export.
    }

    // Out of retries — record failure with the latest violations.
    return this.deps.stateStore.withLock(working.id, async () => {
      const failed = this.buildFailedCardFromCard({
        base: working,
        failedStage: "image-director",
        violations: working.violations ?? [],
      });
      // The render path can't fail with stage "render-validate" yet — the
      // failedStage enum doesn't include it. Keep it on image-director for now;
      // the violations list carries the L2 codes so callers can route.
      await this.deps.stateStore.write(failed.id, failed);
      return failed;
    });
  }

  private buildFailedCardFromCard(args: {
    base: Card;
    failedStage: "analyst" | "copywriter" | "image-director";
    violations: Violation[];
  }): Card {
    return CardSchema.parse({
      ...args.base,
      status: "draft.failed" as CardStatus,
      failedStage: args.failedStage,
      violations: args.violations,
      recoverOptions: {
        forceProceed: false,
        manualEdit: true,
        restart: true,
      },
      updatedAt: this.now(),
    });
  }
}
