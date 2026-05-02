import { z } from "zod";
import { CardStatusSchema } from "./card-status";
import { ClaimLedgerSchema } from "./claim-ledger";
import { NarrativeArcSchema } from "./narrative-arc";
import { PageSchema } from "./page";
import { SourcePolicySchema } from "./source-policy";

export const PipelineStage = z.enum([
  "fact-checker",
  "analyst",
  "copywriter",
  "image-director",
  "render-validate",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const ViolationSchema = z.object({
  level: z.enum(["L1", "L2", "L3"]).optional(),
  code: z.string().min(1),
  message: z.string().min(1),
  pageIndex: z.number().int().min(1).optional(),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type Violation = z.infer<typeof ViolationSchema>;

export const AttemptLogSchema = z.object({
  stage: PipelineStage,
  startedAt: z.string().min(1),
  endedAt: z.string().min(1).optional(),
  ok: z.boolean(),
  violations: z.array(ViolationSchema).optional(),
  note: z.string().optional(),
});
export type AttemptLog = z.infer<typeof AttemptLogSchema>;

export const RecoverOptionsSchema = z.object({
  forceProceed: z.boolean().default(false),
  manualEdit: z.boolean().default(false),
  restart: z.boolean().default(false),
});
export type RecoverOptions = z.infer<typeof RecoverOptionsSchema>;

// pipelineVersion records which pipeline produced this card.
// Set on Card creation; never mutated. v1-mocked = M1 mock pipeline,
// v2-editorial = M2+ Claim Ledger / copyIntent / Editorial Review pipeline.
// See docs/superpowers/specs/2026-05-02-claim-ledger-revision.md §12.
export const PipelineVersion = z.enum(["v1-mocked", "v2-editorial"]);
export type PipelineVersion = z.infer<typeof PipelineVersion>;

export const CardSchema = z
  .object({
    id: z.string().min(1),
    series: z.string().min(1),
    preset: z.string().min(1),
    pipelineVersion: PipelineVersion.default("v1-mocked"),
    topic: z.string().optional(),
    sourceText: z.string().optional(),
    sourcePolicy: SourcePolicySchema,
    coreMessage: z.string().min(1),
    thesis: z.string().optional(),
    audienceQuestion: z.string().optional(),
    narrativeArc: NarrativeArcSchema.optional(),
    claimLedger: ClaimLedgerSchema.optional(),
    pages: z.array(PageSchema).min(3),
    status: CardStatusSchema,
    failedStage: PipelineStage.optional(),
    violations: z.array(ViolationSchema).optional(),
    recoverOptions: RecoverOptionsSchema.optional(),
    attempts: z.array(AttemptLogSchema).default([]),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    syncedToFigmaAt: z.string().optional(),
    figmaNodeId: z.string().optional(),
  })
  .superRefine((card, ctx) => {
    const pages = card.pages;
    if (pages.length === 0) return;

    if (pages[0].role !== "cover") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages", 0, "role"],
        message: "first page must have role 'cover'",
      });
    }

    const last = pages[pages.length - 1];
    if (last.role !== "cta") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages", pages.length - 1, "role"],
        message: "last page must have role 'cta'",
      });
    }

    for (let i = 1; i < pages.length - 1; i++) {
      if (pages[i].role !== "body") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", i, "role"],
          message: "middle pages must have role 'body'",
        });
      }
    }

    const bodyLayouts = new Set(
      pages
        .slice(1, -1)
        .filter((p) => p.role === "body")
        .map((p) => p.layout)
    );
    if (bodyLayouts.size < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages"],
        message: "must use at least 2 distinct body layouts",
      });
    }

    if (card.pipelineVersion === "v2-editorial") {
      if (!card.thesis) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["thesis"],
          message: "v2-editorial requires thesis",
        });
      }
      if (!card.audienceQuestion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audienceQuestion"],
          message: "v2-editorial requires audienceQuestion",
        });
      }
      if (!card.narrativeArc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["narrativeArc"],
          message: "v2-editorial requires narrativeArc",
        });
      }
      if (!card.claimLedger) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["claimLedger"],
          message: "v2-editorial requires claimLedger",
        });
      }

      for (const [i, p] of pages.entries()) {
        if (!p.copyIntent) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pages", i, "copyIntent"],
            message: "v2-editorial requires copyIntent on every page",
          });
        }
      }

      const ledgerIds = new Set(
        card.claimLedger?.claims.map((c) => c.id) ?? []
      );
      for (const [pi, p] of pages.entries()) {
        const claims = p.claims ?? [];
        for (const [ci, claimId] of claims.entries()) {
          if (!ledgerIds.has(claimId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pages", pi, "claims", ci],
              message: `Page references unknown claim id: ${claimId}`,
            });
          }
        }
      }
    }
  });

export type Card = z.infer<typeof CardSchema>;
