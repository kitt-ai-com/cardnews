import type { AgentPort } from "../../core/agents/ports";

export interface FallbackLatch {
  tripped: boolean;
  reason?: string;
  trippedAt?: string;
}

export interface DualAgentRunnerConfig<I, O> {
  claude: AgentPort<I, O>;
  codex: AgentPort<I, O>;
  latch: FallbackLatch;
  onSwitch?: (info: { agent: string; reason: string }) => void;
}

const DEFAULT_ON_SWITCH = (info: { agent: string; reason: string }) => {
  console.error(
    `[dual-runner] switching to Codex for the rest of this pipeline ` +
      `(triggered by ${info.agent}): ${info.reason}`
  );
};

export function makeDualAgentRunner<I, O>(
  config: DualAgentRunnerConfig<I, O>
): AgentPort<I, O> {
  const { claude, codex, latch, onSwitch = DEFAULT_ON_SWITCH } = config;

  return {
    name: claude.name,
    contract: claude.contract,
    async run(input: I): Promise<O> {
      if (latch.tripped) {
        return codex.run(input);
      }

      try {
        return await claude.run(input);
      } catch (err) {
        if (isCreditExhausted(err)) {
          const reason = err instanceof Error ? err.message : String(err);
          latch.tripped = true;
          latch.reason = reason;
          latch.trippedAt = new Date().toISOString();
          onSwitch({ agent: claude.name, reason });
          return codex.run(input);
        }
        throw err;
      }
    },
  };
}

function isCreditExhausted(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("credit_balance_too_low") ||
    msg.includes("credit balance is too low") ||
    msg.includes("anthropic_api_key env var not set")
  );
}
