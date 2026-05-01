import { z } from "zod";
import { LayoutId } from "../../schemas/preset";
import { PageRole } from "../../schemas/page";
import { SourcePolicySchema } from "../../schemas/source-policy";

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

export const AnalystOutputSchema = z.object({
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
      }),
    )
    .min(3),
});
export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;
