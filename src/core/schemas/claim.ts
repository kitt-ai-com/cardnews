import { z } from "zod";

export const ClaimType = z.enum([
  "fact",
  "number",
  "quote",
  "interpretation",
  "recommendation",
]);
export type ClaimType = z.infer<typeof ClaimType>;

export const ClaimConfidence = z.enum(["high", "medium", "low"]);
export type ClaimConfidence = z.infer<typeof ClaimConfidence>;

export const ClaimRisk = z.enum([
  "none",
  "needs-context",
  "disputed",
  "outdated",
]);
export type ClaimRisk = z.infer<typeof ClaimRisk>;

export const ClaimSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    type: ClaimType,
    evidence: z.string().optional(),
    confidence: ClaimConfidence,
    sourceRef: z.string().optional(),
    risk: ClaimRisk.default("none"),
    asOf: z.string().optional(),
    scope: z.array(z.string()).default([]),
  })
  .superRefine((c, ctx) => {
    if (c.type === "number" && !c.evidence && !c.sourceRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Claim of type 'number' must have evidence or sourceRef",
        path: ["evidence"],
      });
    }
    if (c.risk === "outdated" && !c.asOf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Claim with risk 'outdated' must have asOf date",
        path: ["asOf"],
      });
    }
  });
export type Claim = z.infer<typeof ClaimSchema>;
