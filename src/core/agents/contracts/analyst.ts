import { z } from "zod";
import { LayoutId } from "../../schemas/preset";
import { PageRole } from "../../schemas/page";
import { SourcePolicySchema } from "../../schemas/source-policy";
import { ClaimLedgerSchema } from "../../schemas/claim-ledger";
import { NarrativeArcSchema } from "../../schemas/narrative-arc";
import { CopyIntent } from "../../schemas/copy-intent";
import { InfoPatternId } from "../../schemas/info-pattern";

export const AnalystInputSchema = z.object({
  series: z.object({
    id: z.string(),
    name: z.string(),
    theme: z.string(),
    audience: z.string(),
    tone: z.string(),
    branding: z.object({ seriesTag: z.string() }),
    footerHandle: z.string(),
  }),
  preset: z.object({
    id: z.string(),
    layouts: z.array(LayoutId).min(1),
  }),
  topic: z.string().optional(),
  sourceText: z.string().optional(),
  sourcePolicy: SourcePolicySchema,
  factCheck: z
    .object({
      confirmed: z.array(z.string()),
      uncertain: z.array(z.string()),
      conflicting: z.array(z.string()),
    })
    .optional(),
  fixViolations: z.array(z.unknown()).optional(),
});
export type AnalystInput = z.infer<typeof AnalystInputSchema>;

export const AnalystOutputSchema = z
  .object({
    // v2 fields (Claim Ledger revision §4)
    thesis: z.string().min(1),
    audienceQuestion: z.string().min(1),
    narrativeArc: NarrativeArcSchema,
    claimLedger: ClaimLedgerSchema,
    // v1 fields retained for backward compat with the v1 Pipeline (M2.G will
    // migrate). Mock + real Analyst MUST populate these — `coreMessage` is
    // typically the same string as `thesis`; `hookStrategy` and `flow` are
    // free-form short strings used only by the v1 orchestrator.
    coreMessage: z.string().min(1),
    hookStrategy: z.string().min(1),
    flow: z.string().min(1),
    pages: z
      .array(
        z.object({
          index: z.number().int().min(1),
          role: PageRole,
          layout: LayoutId,
          workingTitle: z.string().min(1),
          message: z.string().min(1),
          mappingNote: z.string().min(1),
          // v2 fields
          copyIntent: CopyIntent,
          claims: z.array(z.string()).default([]),
          infoPattern: InfoPatternId.optional(),
        }),
      )
      .min(3),
  })
  .superRefine((out, ctx) => {
    // Page.claims must reference existing ledger ids.
    const ids = new Set(out.claimLedger.claims.map((c) => c.id));
    for (const [pi, p] of out.pages.entries()) {
      for (const [ci, claimId] of (p.claims ?? []).entries()) {
        if (!ids.has(claimId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pages", pi, "claims", ci],
            message: `Page references unknown claim id: ${claimId}`,
          });
        }
      }
    }
    // First page must be cover, last must be cta, middle must be body.
    if (out.pages[0].role !== "cover") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages", 0, "role"],
        message: "first page must be cover",
      });
    }
    const last = out.pages[out.pages.length - 1];
    if (last.role !== "cta") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages", out.pages.length - 1, "role"],
        message: "last page must be cta",
      });
    }
    for (let i = 1; i < out.pages.length - 1; i++) {
      if (out.pages[i].role !== "body") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", i, "role"],
          message: "middle pages must be body",
        });
      }
    }
    // ≥2 distinct body layouts.
    const bodyLayouts = new Set(
      out.pages.filter((p) => p.role === "body").map((p) => p.layout),
    );
    if (bodyLayouts.size < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages"],
        message: "must use at least 2 distinct body layouts",
      });
    }
  });
export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;
