import { z } from "zod";
import { LayoutId } from "../../schemas/preset";

export const ImageDirectorInputSchema = z.object({
  preset: z.object({ imageStyle: z.string() }),
  page: z.object({
    index: z.number().int(),
    layout: LayoutId,
    purpose: z.string(),
    title: z.string(),
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
