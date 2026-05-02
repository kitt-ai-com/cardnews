import { z } from "zod";
import { LayoutId } from "../../schemas/preset";
import { PageRole } from "../../schemas/page";
import { ClaimSchema } from "../../schemas/claim";
import { CopyIntent } from "../../schemas/copy-intent";
import { InfoPatternId } from "../../schemas/info-pattern";

export const CopyContextSchema = z.object({
  tone: z.string(),
  recurringTerms: z.array(z.string()).default([]),
  usedExamples: z.array(z.string()).default([]),
  forbiddenRepeats: z.array(z.string()).default([]),
  // v2: rolling commitments across pages within a card. The Copywriter sees
  // which ledger claim ids have already been spent (committedClaims) and which
  // remain unaddressed (pendingClaims). See spec §5. Optional (not defaulted)
  // because v1 Pipeline constructs CopyContext literals without these fields
  // and assigns them to the inferred CopyContext TS type; making them
  // .default([]) would make them required in the output type and break that
  // legacy callsite. M2.G will wire them properly.
  committedClaims: z.array(z.string()).optional(),
  pendingClaims: z.array(z.string()).optional(),
});
export type CopyContext = z.infer<typeof CopyContextSchema>;

export const CopywriterPageInputSchema = z.object({
  series: z.object({
    name: z.string(),
    audience: z.string(),
    tone: z.string(),
    branding: z.object({ seriesTag: z.string() }),
  }),
  outline: z.unknown(),
  page: z.object({
    index: z.number().int(),
    role: PageRole,
    layout: LayoutId,
    workingTitle: z.string(),
    message: z.string(),
    mappingNote: z.string(),
    // v2: copyIntent/claims/infoPattern. All optional (not defaulted) for v1
    // Pipeline compatibility — that path constructs page literals without
    // these fields and assigns to the inferred CopywriterPageInput type, so a
    // .default([]) would force the field into the output type and break the
    // legacy callsite. The Copywriter system prompt treats them as required.
    // M2.G will tighten this once Pipeline is rewritten.
    copyIntent: CopyIntent.optional(),
    claims: z.array(z.string()).optional(),
    infoPattern: InfoPatternId.optional(),
  }),
  // v2: subset of the Claim Ledger relevant to THIS page (the ids in
  // page.claims). The Copywriter cites only from this slice. Optional for
  // v1-Pipeline compatibility; M2.G fills it from the Analyst's ledger.
  ledgerSlice: z.array(ClaimSchema).optional(),
  copyContext: CopyContextSchema,
  sourceTextSlice: z.string().optional(),
  fixViolations: z.array(z.unknown()).optional(),
});
export type CopywriterPageInput = z.infer<typeof CopywriterPageInputSchema>;

export const CopywriterPageOutputSchema = z.object({
  copy: z.object({
    label: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    body: z.string().optional(),
    list: z.array(z.string()).optional(),
    highlight: z.string().optional(),
    pageNum: z.string().optional(),
  }),
  // v2: which ledger claim ids this page's copy actually committed.
  // Should be a subset of input.page.claims.
  committedClaimIds: z.array(z.string()).default([]),
  copyContextDelta: CopyContextSchema.partial().optional(),
});
export type CopywriterPageOutput = z.infer<typeof CopywriterPageOutputSchema>;
