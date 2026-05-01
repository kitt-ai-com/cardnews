import { z } from "zod";
import { CardStatusSchema } from "./card-status";
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

export const CardSchema = z
  .object({
    id: z.string().min(1),
    series: z.string().min(1),
    preset: z.string().min(1),
    topic: z.string().optional(),
    sourceText: z.string().optional(),
    sourcePolicy: SourcePolicySchema,
    coreMessage: z.string().min(1),
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
  });

export type Card = z.infer<typeof CardSchema>;
