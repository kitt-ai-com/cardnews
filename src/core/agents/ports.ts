import type { ZodType, ZodTypeDef } from "zod";

// Schemas with `.default(...)` produce different input vs output types in zod.
// inputSchema accepts `unknown` at the boundary and produces I after parse.
// outputSchema produces O from O (or stricter input — schema authors decide).
export interface AgentContract<I, O> {
  inputSchema: ZodType<I, ZodTypeDef, unknown>;
  outputSchema: ZodType<O, ZodTypeDef, unknown>;
  systemPromptPath: string;
}

export interface AgentPort<I, O> {
  name: string;
  run(input: I): Promise<O>;
  contract: AgentContract<I, O>;
}
