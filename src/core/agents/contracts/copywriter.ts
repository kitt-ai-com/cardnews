import { z } from "zod";
import { LayoutId } from "../../schemas/preset";
import { PageRole } from "../../schemas/page";

export const CopyContextSchema = z.object({
  tone: z.string(),
  recurringTerms: z.array(z.string()).default([]),
  usedExamples: z.array(z.string()).default([]),
  forbiddenRepeats: z.array(z.string()).default([]),
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
  }),
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
  copyContextDelta: CopyContextSchema.partial().optional(),
});
export type CopywriterPageOutput = z.infer<typeof CopywriterPageOutputSchema>;
