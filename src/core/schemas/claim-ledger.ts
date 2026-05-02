import { z } from "zod";
import { ClaimSchema } from "./claim";

export const SourceKind = z.enum([
  "official-doc",
  "press-release",
  "blog",
  "user-text",
  "user-url",
  "search-result",
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourceTrustLevel = z.enum([
  "primary",
  "secondary",
  "user-provided",
  "unknown",
]);
export type SourceTrustLevel = z.infer<typeof SourceTrustLevel>;

export const SourceRecordSchema = z.object({
  ref: z.string().min(1),
  kind: SourceKind,
  trustLevel: SourceTrustLevel,
  retrievedAt: z.string().min(1),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

export const ClaimLedgerSchema = z
  .object({
    claims: z.array(ClaimSchema).min(1),
    sourceDigest: z.object({
      sources: z.array(SourceRecordSchema).default([]),
      audienceQuestion: z.string().min(1),
    }),
  })
  .superRefine((ledger, ctx) => {
    const ids = new Set<string>();
    for (const [i, c] of ledger.claims.entries()) {
      if (ids.has(c.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate claim id: ${c.id}`,
          path: ["claims", i, "id"],
        });
      }
      ids.add(c.id);
    }
  });
export type ClaimLedger = z.infer<typeof ClaimLedgerSchema>;
