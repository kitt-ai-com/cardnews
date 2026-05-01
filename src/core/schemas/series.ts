import { z } from "zod";

export const SeriesSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  theme: z.string().min(1),
  defaultPreset: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  imageStyleOverride: z.string().optional(),
  branding: z.object({
    seriesTag: z.string().min(1),
    logo: z.string().optional(),
  }),
  footerHandle: z.string().min(1),
  trustedDomains: z.array(z.string()).default([]),
  imageProvider: z.string().default("codex-image"),
});

export type Series = z.infer<typeof SeriesSchema>;
