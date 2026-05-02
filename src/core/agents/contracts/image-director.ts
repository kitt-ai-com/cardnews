import { z } from "zod";
import { LayoutId } from "../../schemas/preset";
import { InfoPatternId } from "../../schemas/info-pattern";

export const ImageDirectorInputSchema = z.object({
  preset: z.object({ imageStyle: z.string() }),
  page: z.object({
    index: z.number().int(),
    layout: LayoutId,
    purpose: z.string(),
    title: z.string(),
    // v2: lets the ImageDirector adapt the background style to the page's
    // info pattern (e.g., I3 mechanism → flowing arrows; I1 claim → centered
    // single subject).
    infoPattern: InfoPatternId.optional(),
  }),
  fixViolations: z.array(z.unknown()).optional(),
});
export type ImageDirectorInput = z.infer<typeof ImageDirectorInputSchema>;

export const ImageDirectorOutputSchema = z.object({
  prompt: z.object({
    text: z.string().min(1),
    size: z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]),
    quality: z.enum(["low", "medium", "high", "auto"]).optional(),
    variations: z.number().int().min(1).optional(),
  }),
  skipReason: z.string().optional(),
});
export type ImageDirectorOutput = z.infer<typeof ImageDirectorOutputSchema>;
