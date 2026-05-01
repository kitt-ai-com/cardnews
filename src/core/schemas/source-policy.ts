import { z } from "zod";

export const TrustLevel = z.enum([
  "primary",
  "secondary",
  "user-provided",
  "unknown",
]);
export type TrustLevel = z.infer<typeof TrustLevel>;

export const FactCheckMode = z.enum(["skip", "warn", "strict"]);
export type FactCheckMode = z.infer<typeof FactCheckMode>;

export const SourcePolicySchema = z.object({
  trustLevel: TrustLevel,
  factCheckMode: FactCheckMode,
});
export type SourcePolicy = z.infer<typeof SourcePolicySchema>;
