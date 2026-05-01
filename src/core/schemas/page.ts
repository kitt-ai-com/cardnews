import { z } from "zod";
import { LayoutId } from "./preset";

export const PageRole = z.enum(["cover", "body", "cta"]);
export type PageRole = z.infer<typeof PageRole>;

export const ImagePromptRef = z.object({
  text: z.string().min(1),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]),
  quality: z.enum(["low", "medium", "high", "auto"]).optional(),
  variations: z.number().int().min(1).optional(),
});
export type ImagePromptRef = z.infer<typeof ImagePromptRef>;

const Copy = z.object({
  label: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  list: z.array(z.string()).optional(),
  highlight: z.string().optional(),
  pageNum: z.string().optional(),
});

const PageImage = z.object({
  path: z.string().min(1),
  prompt: ImagePromptRef.optional(), // null/undefined => user-attached
  providerMeta: z.record(z.string(), z.unknown()).optional(),
  manualOverride: z.boolean().default(false),
});

export const PageSchema = z.object({
  index: z.number().int().min(1),
  role: PageRole,
  layout: LayoutId,
  message: z.string().min(1),
  mappingNote: z.string().min(1),
  copy: Copy,
  image: PageImage.optional(),
  manualEdit: z.boolean().default(false),
});

export type Page = z.infer<typeof PageSchema>;
