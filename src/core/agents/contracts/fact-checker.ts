import { z } from "zod";
import { SourcePolicySchema } from "../../schemas/source-policy";

export const FactCheckerInputSchema = z.object({
  topic: z.string().optional(),
  sourceText: z.string().optional(),
  sourcePolicy: SourcePolicySchema,
});
export type FactCheckerInput = z.infer<typeof FactCheckerInputSchema>;

export const ClaimStatus = z.enum(["confirmed", "uncertain", "conflicting"]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

export const FactCheckerOutputSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string().min(1),
        status: ClaimStatus,
        reason: z.string().min(1),
        sourceHint: z.string().optional(),
      }),
    )
    .default([]),
});
export type FactCheckerOutput = z.infer<typeof FactCheckerOutputSchema>;
