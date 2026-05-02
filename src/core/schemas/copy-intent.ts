import { z } from "zod";

export const CopyIntent = z.enum([
  "hook",
  "context",
  "definition",
  "comparison",
  "mechanism",
  "evidence",
  "example",
  "warning",
  "action",
  "cta",
]);
export type CopyIntent = z.infer<typeof CopyIntent>;
