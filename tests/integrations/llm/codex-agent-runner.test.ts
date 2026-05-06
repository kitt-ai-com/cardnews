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

  it("throws when codex exits non-zero, including stderr tail", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 1,
      stderr: "auth required: please run codex login",
      lastMessage: "",
    });
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "t",
      callCodex,
    });
    await expect(runner.run({ prompt: "x" })).rejects.toThrow(
      /Codex CLI failed.*auth required/
    );
  });

  it("throws on empty response", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      lastMessage: "",
    });
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "t",
      callCodex,
    });
    await expect(runner.run({ prompt: "x" })).rejects.toThrow(/empty response/);
  });

  it("throws on JSON parse failure", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      lastMessage: "this is not json",
    });
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "t",
      callCodex,
    });
    await expect(runner.run({ prompt: "x" })).rejects.toThrow(/Failed to parse JSON/);
  });

  it("throws on zod validation failure", async () => {
    const callCodex = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      lastMessage: '{"wrong":"schema"}',
    });
    const runner = makeCodexAgentRunner({
      contract: mockContract,
      name: "t",
      callCodex,
    });
    await expect(runner.run({ prompt: "x" })).rejects.toThrow();
  });
});
