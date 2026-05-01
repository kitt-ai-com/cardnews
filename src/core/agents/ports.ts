import type { ZodType } from "zod";

export interface AgentContract<I, O> {
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  systemPromptPath: string;
}

export interface AgentPort<I, O> {
  name: string;
  run(input: I): Promise<O>;
  contract: AgentContract<I, O>;
}
