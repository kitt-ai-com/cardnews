import { describe, it, expect, beforeEach, vi, MockedFunction } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { AgentContract } from "../../../src/core/agents/ports";
import { z } from "zod";

// Create a class for APIError to use in tests
class MockAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

// Mock the Anthropic SDK BEFORE importing the runner
// Note: This needs to be hoisted, so we define the factory inline
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  const APIError = class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "APIError";
    }
  };
  return {
    default: class MockAnthropicClient {
      messages = { create: mockCreate };
      static APIError = APIError;
    },
  };
});

// Now import the runner and Anthropic
import Anthropic from "@anthropic-ai/sdk";
import { makeClaudeAgentRunner } from "../../../src/integrations/llm/claude-agent-runner";

const testDir = import.meta.dirname;
const projectRoot = path.join(testDir, "../../../");

// Simple test schema
const TestInputSchema = z.object({
  prompt: z.string(),
});
type TestInput = z.infer<typeof TestInputSchema>;

const TestOutputSchema = z.object({
  foo: z.string(),
  count: z.number().optional(),
});
type TestOutput = z.infer<typeof TestOutputSchema>;

const mockContract: AgentContract<TestInput, TestOutput> = {
  inputSchema: TestInputSchema,
  outputSchema: TestOutputSchema,
  systemPromptPath: "tests/integrations/llm/_fixtures/sample-prompt.md",
};

describe("claude-agent-runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: returns parsed output on successful call", async () => {
    const mockClient = new Anthropic() as any;
    (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo":"bar"}' }],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
      maxRetries: 3,
    });

    const result = await runner.run({ prompt: "test input" });

    expect(result).toEqual({ foo: "bar" });
    expect(mockClient.messages.create).toHaveBeenCalledOnce();
  });

  it("prompt caching headers present on system blocks", async () => {
    const mockClient = new Anthropic() as any;
    (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo":"baz"}' }],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
      repoRoot: projectRoot,
    });

    await runner.run({ prompt: "test input" });

    expect(mockClient.messages.create).toHaveBeenCalledOnce();
    const callArgs = (mockClient.messages.create as MockedFunction<any>).mock
      .calls[0][0] as any;

    // Verify system is an array with cache_control on blocks
    expect(Array.isArray(callArgs.system)).toBe(true);
    expect(callArgs.system.length).toBeGreaterThan(0);

    // Check first system block (prompt) has cache_control
    const firstBlock = callArgs.system[0] as any;
    expect(firstBlock).toHaveProperty("cache_control");
    expect(firstBlock.cache_control.type).toBe("ephemeral");
  });

  it("retries on HTTP 429", async () => {
    const mockClient = new Anthropic() as any;
    const mockCreate = mockClient.messages.create as MockedFunction<any>;

    // Create error using the mocked APIError class
    const APIError = (Anthropic as any).APIError;
    mockCreate.mockRejectedValueOnce(new APIError("Too Many Requests", 429));
    mockCreate.mockRejectedValueOnce(new APIError("Too Many Requests", 429));
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo":"success"}' }],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
      maxRetries: 3,
    });

    const result = await runner.run({ prompt: "test input" });

    expect(result).toEqual({ foo: "success" });
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("no retry on HTTP 400", async () => {
    const mockClient = new Anthropic() as any;
    const mockCreate = mockClient.messages.create as MockedFunction<any>;

    const APIError = (Anthropic as any).APIError;
    mockCreate.mockRejectedValueOnce(new APIError("Bad Request", 400));

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
      maxRetries: 3,
    });

    await expect(runner.run({ prompt: "test input" })).rejects.toThrow(
      /400|bad request/i
    );
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("schema parse failure throws with diagnostic", async () => {
    const mockClient = new Anthropic() as any;
    (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo":"bar"}' }], // missing required field
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    const strictContract: AgentContract<TestInput, TestOutput> = {
      ...mockContract,
      outputSchema: z.object({
        foo: z.string(),
        requiredField: z.string(),
      }) as any,
    };

    const runner = makeClaudeAgentRunner({
      contract: strictContract,
      name: "test-agent",
      client: mockClient,
    });

    await expect(runner.run({ prompt: "test" })).rejects.toThrow(
      /required|invalid/i
    );
  });

  it("markdown fence stripping works", async () => {
    const mockClient = new Anthropic() as any;
    (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: '```json\n{"foo":"extracted"}\n```',
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
    });

    const result = await runner.run({ prompt: "test" });
    expect(result).toEqual({ foo: "extracted" });
  });

  it("token usage logged to file", async () => {
    const tmpTokenDir = path.join(testDir, ".tmp-tokens");
    await fs.mkdir(tmpTokenDir, { recursive: true });

    const mockClient = new Anthropic() as any;
    (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo":"logged"}' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 25,
        cache_creation_input_tokens: 10,
      },
    });

    const runner = makeClaudeAgentRunner({
      contract: mockContract,
      name: "test-agent",
      client: mockClient,
      tokenLogPath: tmpTokenDir,
    });

    await runner.run({ prompt: "test" });

    const tokensFile = path.join(tmpTokenDir, ".tokens.jsonl");
    const content = await fs.readFile(tokensFile, "utf-8");
    const lines = content.trim().split("\n");

    expect(lines.length).toBeGreaterThan(0);
    const record = JSON.parse(lines[0]);

    expect(record).toHaveProperty("agent", "test-agent");
    expect(record).toHaveProperty("input_tokens", 100);
    expect(record).toHaveProperty("output_tokens", 50);
    expect(record).toHaveProperty("cache_read", 25);
    expect(record).toHaveProperty("cache_create", 10);
    expect(record).toHaveProperty("model");
    expect(record).toHaveProperty("ts");

    // Cleanup
    await fs.rm(tmpTokenDir, { recursive: true });
  });

  it("missing ANTHROPIC_API_KEY throws at construction time", () => {
    // Temporarily remove env var
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      expect(() => {
        makeClaudeAgentRunner({
          contract: mockContract,
          name: "test-agent",
          // no client provided
        });
      }).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});
