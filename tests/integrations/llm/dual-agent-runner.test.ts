import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { AgentContract, AgentPort } from "../../../src/core/agents/ports";
import {
  makeDualAgentRunner,
  type FallbackLatch,
} from "../../../src/integrations/llm/dual-agent-runner";

const TestInputSchema = z.object({ p: z.string() });
const TestOutputSchema = z.object({ r: z.string() });
type In = z.infer<typeof TestInputSchema>;
type Out = z.infer<typeof TestOutputSchema>;

const contract: AgentContract<In, Out> = {
  inputSchema: TestInputSchema,
  outputSchema: TestOutputSchema,
  systemPromptPath: "irrelevant.md",
};

const makeFakeRunner = (
  name: string,
  impl: (input: In) => Promise<Out> | Out
): AgentPort<In, Out> => ({
  name,
  contract,
  run: vi.fn(async (input: In) => impl(input)),
});

describe("dual-agent-runner", () => {
  it("uses claude when latch is false and claude succeeds", async () => {
    const claude = makeFakeRunner("claude", async () => ({ r: "from-claude" }));
    const codex = makeFakeRunner("codex", async () => ({ r: "from-codex" }));
    const latch: FallbackLatch = { tripped: false };

    const dual = makeDualAgentRunner({ claude, codex, latch });
    const result = await dual.run({ p: "x" });

    expect(result).toEqual({ r: "from-claude" });
    expect(claude.run).toHaveBeenCalledOnce();
    expect(codex.run).not.toHaveBeenCalled();
    expect(latch.tripped).toBe(false);
  });

  it("flips latch and falls back to codex on credit_balance_too_low error", async () => {
    const claude = makeFakeRunner("claude", async () => {
      throw new Error("Claude API error (400): credit_balance_too_low");
    });
    const codex = makeFakeRunner("codex", async () => ({ r: "from-codex" }));
    const latch: FallbackLatch = { tripped: false };
    const onSwitch = vi.fn();

    const dual = makeDualAgentRunner({ claude, codex, latch, onSwitch });
    const result = await dual.run({ p: "x" });

    expect(result).toEqual({ r: "from-codex" });
    expect(claude.run).toHaveBeenCalledOnce();
    expect(codex.run).toHaveBeenCalledOnce();
    expect(latch.tripped).toBe(true);
    expect(latch.reason).toMatch(/credit_balance_too_low/);
    expect(latch.trippedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(onSwitch).toHaveBeenCalledOnce();
  });

  it("re-throws non-credit errors without flipping latch", async () => {
    const claude = makeFakeRunner("claude", async () => {
      throw new Error("Anthropic API auth failed. Check ANTHROPIC_API_KEY.");
    });
    const codex = makeFakeRunner("codex", async () => ({ r: "x" }));
    const latch: FallbackLatch = { tripped: false };

    const dual = makeDualAgentRunner({ claude, codex, latch });

    await expect(dual.run({ p: "x" })).rejects.toThrow(/auth failed/);
    expect(codex.run).not.toHaveBeenCalled();
    expect(latch.tripped).toBe(false);
  });

  it("uses codex directly when latch is already tripped", async () => {
    const claude = makeFakeRunner("claude", async () => ({ r: "no" }));
    const codex = makeFakeRunner("codex", async () => ({ r: "yes" }));
    const latch: FallbackLatch = { tripped: true, reason: "earlier" };

    const dual = makeDualAgentRunner({ claude, codex, latch });
    const result = await dual.run({ p: "x" });

    expect(result).toEqual({ r: "yes" });
    expect(claude.run).not.toHaveBeenCalled();
    expect(codex.run).toHaveBeenCalledOnce();
  });

  it("shared latch — flip in runner A causes runner B to skip claude", async () => {
    const latch: FallbackLatch = { tripped: false };

    const claudeA = makeFakeRunner("claudeA", async () => {
      throw new Error("credit balance is too low");
    });
    const codexA = makeFakeRunner("codexA", async () => ({ r: "A-codex" }));
    const dualA = makeDualAgentRunner({ claude: claudeA, codex: codexA, latch });

    const claudeB = makeFakeRunner("claudeB", async () => ({ r: "B-claude" }));
    const codexB = makeFakeRunner("codexB", async () => ({ r: "B-codex" }));
    const dualB = makeDualAgentRunner({ claude: claudeB, codex: codexB, latch });

    await dualA.run({ p: "1" });
    expect(latch.tripped).toBe(true);

    await dualB.run({ p: "2" });
    expect(claudeB.run).not.toHaveBeenCalled();
    expect(codexB.run).toHaveBeenCalledOnce();
  });

  it("exposes name and contract from the claude runner", () => {
    const claude = makeFakeRunner("clauder", async () => ({ r: "z" }));
    const codex = makeFakeRunner("codexer", async () => ({ r: "z" }));
    const latch: FallbackLatch = { tripped: false };
    const dual = makeDualAgentRunner({ claude, codex, latch });
    expect(dual.name).toBe("clauder");
    expect(dual.contract).toBe(contract);
  });
});
