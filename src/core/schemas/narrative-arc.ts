import { z } from "zod";

export const NarrativeArcSchema = z.object({
  hook: z.string().min(1),
  context: z.string().min(1),
  mechanism: z.string().min(1),
  evidence: z.string().min(1),
  implication: z.string().min(1),
  action: z.string().min(1),
});
export type NarrativeArc = z.infer<typeof NarrativeArcSchema>;
