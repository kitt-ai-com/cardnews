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
import { merge } from "../validators/types";
import { withRetry } from "./retry";
import { describeApprove } from "./approve";

export interface PipelineDeps {
  stateStore: StateStore;
  analyst: AgentPort<AnalystInput, AnalystOutput>;
  copywriter: AgentPort<CopywriterPageInput, CopywriterPageOutput>;
  imageDirector: AgentPort<ImageDirectorInput, ImageDirectorOutput>;
  factChecker: AgentPort<FactCheckerInput, FactCheckerOutput>;
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

export class Pipeline {
  private readonly deps: PipelineDeps;
  private readonly now: () => string;
  private readonly idGen: () => string;

  constructor(deps: PipelineDeps) {
    this.deps = deps;
    this.now = deps.now ?? defaultNow;
    this.idGen = deps.idGen ?? defaultIdGen;
  }

  async start(args: StartArgs): Promise<Card> {
    const requestedVersion = args.pipelineVersion ?? "v1-mocked";
    if (requestedVersion !== "v1-mocked") {
      throw new Error(
        "v2-editorial pipeline not implemented in M1 (NotImplementedError)"
      );
    }

    const id = this.idGen();
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
        return this.markExportedStub(current);
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

        const input: CopywriterPageInput = {
          series: {
            name: card.series,
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
          },
          copyContext,
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
          const failed = this.buildFailedCardFromCard({
            base: writingCard,
            failedStage: "copywriter",
            violations: retry.violations,
          });
          await this.deps.stateStore.write(card.id, failed);
          return failed;
        }

        updatedPages[i] = { ...page, copy: retry.value.copy };
      }

      const ready: Card = CardSchema.parse({
        ...writingCard,
        pages: updatedPages,
        status: "draft.copy-ready",
        updatedAt: this.now(),
      });
      await this.deps.stateStore.write(card.id, ready);
      return ready;
    });
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

  private async markExportedStub(card: Card): Promise<Card> {
    return this.deps.stateStore.withLock(card.id, async () => {
      const exported: Card = CardSchema.parse({
        ...card,
        status: "exported",
        updatedAt: this.now(),
      });
      await this.deps.stateStore.write(card.id, exported);
      return exported;
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
