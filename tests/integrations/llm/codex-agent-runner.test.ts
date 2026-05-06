import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { z } from "zod";
import type { AgentContract } from "../../../src/core/agents/ports";
import { makeCodexAgentRunner } from "../../../src/integrations/llm/codex-agent-runner";

const TestInputSchema = z.object({ prompt: z.string() });
type TestInput = z.infer<typeof TestInputSchema>;

const TestOutputSchema = z.object({ foo: z.string(), count: z.number().optional() });
type TestOutput = z.infer<typeof TestOutputSchema>;

const mockContract: AgentContract<TestInput, TestOutput> = {
  inputSchema: TestInputSchema,
  outputSchema: TestOutputSchema,
  systemPromptPath: "tests/integrations/llm/_fixtures/sample-prompt.md",
};

describe("codex-agent-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("happy path: returns parsed output on successful codex call", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      lastMessage: '{"foo":"bar"}',
    });

    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "test-agent",
      callCodex,
    });

    const result = await runner.run({ prompt: "hello" });

    expect(result).toEqual({ foo: "bar" });
    expect(callCodex).toHaveBeenCalledOnce();
    const callArg = callCodex.mock.calls[0][0];
    expect(callArg.prompt).toContain("Sample System Prompt");
    expect(callArg.prompt).toContain('"prompt":"hello"');
    expect(callArg.prompt).toMatch(/Return ONLY a JSON object/);
  });

  it("strips markdown fences from response", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      lastMessage: '```json\n{"foo":"qux"}\n```',
    });
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "test-agent",
      callCodex,
    });
    const result = await runner.run({ prompt: "hi" });
    expect(result).toEqual({ foo: "qux" });
  });

  it("validates input against contract.inputSchema before calling codex", async () => {
    const callCodex = vi.fn();
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "test-agent",
      callCodex,
    });
    await expect(runner.run({ prompt: 123 } as any)).rejects.toThrow();
    expect(callCodex).not.toHaveBeenCalled();
  });

  it("name and contract are exposed on the AgentPort", () => {
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "ana",
      callCodex: vi.fn(),
    });
    expect(runner.name).toBe("ana");
    expect(runner.contract).toBe(mockContract);
  });
});
