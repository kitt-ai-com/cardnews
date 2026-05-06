# Codex LLM Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** m2 파이프라인에 Anthropic→Codex 자동 폴백 듀얼 백엔드를 추가한다. `credit_balance_too_low` 발생 또는 키 부재 시 같은 파이프라인 안에서 Codex CLI 로 즉시 전환.

**Architecture:** 기존 `claude-agent-runner` (`AgentPort<I,O>`) 는 거의 그대로 두고, 동일 계약을 따르는 `codex-agent-runner` 신규 추가, 둘을 합성하는 `dual-agent-runner` 가 공유 latch 로 한 번 flip 되면 파이프라인 잔여 호출 전체를 Codex 로 직행시킨다. m2-first-v2.ts 가 4개 에이전트를 dual runner 로 wrap 한다.

**Tech Stack:** TypeScript, Bun, vitest, zod, @anthropic-ai/sdk (기존), `codex` CLI (subprocess via `node:child_process.spawn`).

**Spec:** [docs/superpowers/specs/2026-05-07-codex-llm-fallback-design.md](../specs/2026-05-07-codex-llm-fallback-design.md)

---

## Task 1: stripMarkdownFences 공유 유틸로 분리

**Files:**
- Create: `src/integrations/llm/util.ts`
- Modify: `src/integrations/llm/claude-agent-runner.ts`
- Test: `tests/integrations/llm/util.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/integrations/llm/util.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stripMarkdownFences } from "../../../src/integrations/llm/util";

describe("stripMarkdownFences", () => {
  it("removes ```json ... ``` fences", () => {
    expect(stripMarkdownFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("removes plain ``` ... ``` fences", () => {
    expect(stripMarkdownFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("trims surrounding whitespace", () => {
    expect(stripMarkdownFences('  \n{"a":1}\n  ')).toBe('{"a":1}');
  });

  it("returns input unchanged when no fences", () => {
    expect(stripMarkdownFences('{"a":1}')).toBe('{"a":1}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```sh
bun run test tests/integrations/llm/util.test.ts
```
Expected: FAIL — `Cannot find module .../util`.

- [ ] **Step 3: Create util.ts with stripMarkdownFences**

`src/integrations/llm/util.ts`:

```ts
/**
 * Strip leading/trailing markdown code fences (```json ... ``` or ``` ... ```)
 * and surrounding whitespace from an LLM response.
 */
export function stripMarkdownFences(text: string): string {
  let result = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  result = result.replace(/^```\n?/, "").replace(/\n?```$/, "");
  return result.trim();
}
```

- [ ] **Step 4: Replace inline copy in claude-agent-runner.ts**

In `src/integrations/llm/claude-agent-runner.ts`:

1. Add at top of file (after existing imports):
```ts
import { stripMarkdownFences } from "./util";
```
2. Delete the local `stripMarkdownFences` function (currently around lines 192-198).

- [ ] **Step 5: Run all tests to verify nothing regressed**

```sh
bun run test
```
Expected: PASS for all 367+ tests including new util ones.

- [ ] **Step 6: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add src/integrations/llm/util.ts src/integrations/llm/claude-agent-runner.ts tests/integrations/llm/util.test.ts
git commit -m "refactor(llm): extract stripMarkdownFences to shared util"
```

---

## Task 2: claude-agent-runner — lazy API key + backend field

**Files:**
- Modify: `src/integrations/llm/claude-agent-runner.ts`
- Test: `tests/integrations/llm/claude-agent-runner.test.ts`

기존: `makeClaudeAgentRunner()` 호출 시 `ANTHROPIC_API_KEY` 없으면 즉시 throw. 변경: 생성은 통과시키고 첫 `.run()` 호출 시점에 throw. 또한 `.tokens.jsonl` 행에 `backend: "claude"` 필드 추가.

- [ ] **Step 1: Add failing tests**

Append to `tests/integrations/llm/claude-agent-runner.test.ts` (within the existing `describe("claude-agent-runner", ...)` block):

```ts
  it("does not throw at construction when ANTHROPIC_API_KEY is missing", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() =>
        makeClaudeAgentRunner({
          contract: mockContract,
          name: "test-agent",
        })
      ).not.toThrow();
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it("throws on first .run() when ANTHROPIC_API_KEY is missing", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const runner = makeClaudeAgentRunner({
        contract: mockContract,
        name: "test-agent",
      });
      await expect(runner.run({ prompt: "x" })).rejects.toThrow(
        /ANTHROPIC_API_KEY/
      );
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it("token log entries include backend: 'claude'", async () => {
    const tmpDir = await fs.mkdtemp(path.join(import.meta.dirname, "tmp-tokens-"));
    try {
      const mockClient = new Anthropic() as any;
      (mockClient.messages.create as MockedFunction<any>).mockResolvedValueOnce({
        content: [{ type: "text", text: '{"foo":"bar"}' }],
        usage: {
          input_tokens: 7,
          output_tokens: 3,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });
      const runner = makeClaudeAgentRunner({
        contract: mockContract,
        name: "claudey",
        client: mockClient,
        tokenLogPath: tmpDir,
      });
      await runner.run({ prompt: "x" });

      const log = await fs.readFile(path.join(tmpDir, ".tokens.jsonl"), "utf8");
      const lastLine = log.trim().split("\n").pop()!;
      const parsed = JSON.parse(lastLine);
      expect(parsed.backend).toBe("claude");
      expect(parsed.agent).toBe("claudey");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```sh
bun run test tests/integrations/llm/claude-agent-runner.test.ts
```
Expected: 3 new tests FAIL (construction throws, no backend field).

- [ ] **Step 3: Make API key check lazy**

In `src/integrations/llm/claude-agent-runner.ts`, replace the eager check (currently lines ~42-51) with:

```ts
  // Resolve client lazily: defer ANTHROPIC_API_KEY validation until first .run()
  // so dual-agent-runner can fall back to Codex when the key is absent or empty.
  let client: Anthropic | undefined = config.client;
  const ensureClient = (): Anthropic => {
    if (client) return client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY env var not set. Run `export ANTHROPIC_API_KEY=...` or pass a client to makeClaudeAgentRunner."
      );
    }
    client = new Anthropic({ apiKey });
    return client;
  };
```

Then inside the `run` method, replace `const response = await client.messages.create(...)` with:

```ts
          const response = await ensureClient().messages.create({
```

- [ ] **Step 4: Add backend field to token log**

In the same file, find the `logTokenUsage` call inside `run()` (around line 121-133) and add `backend: "claude"` to the record:

```ts
            await logTokenUsage(
              {
                agent: name,
                model,
                attempt,
                input_tokens: response.usage.input_tokens,
                output_tokens: response.usage.output_tokens,
                cache_read: response.usage.cache_read_input_tokens || 0,
                cache_create: response.usage.cache_creation_input_tokens || 0,
                backend: "claude",
              },
              tokenLogPath
            );
```

Update the `logTokenUsage` function signature (bottom of file) to accept the field:

```ts
async function logTokenUsage(
  record: {
    agent: string;
    model: string;
    attempt: number;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_create: number;
    backend: "claude" | "codex";
  },
  tokenLogPath?: string
): Promise<void> {
  if (!tokenLogPath) return;
  const line = JSON.stringify({
    agent: record.agent,
    ts: new Date().toISOString(),
    model: record.model,
    attempt: record.attempt,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens,
    cache_read: record.cache_read,
    cache_create: record.cache_create,
    backend: record.backend,
  });
  try {
    const tokensFile = path.join(tokenLogPath, ".tokens.jsonl");
    await fs.mkdir(tokenLogPath, { recursive: true });
    await fs.appendFile(tokensFile, line + "\n");
  } catch (err) {
    console.error(
      `Failed to log token usage: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```sh
bun run test tests/integrations/llm/claude-agent-runner.test.ts
```
Expected: PASS for all tests in this file.

- [ ] **Step 6: Run full suite**

```sh
bun run test
```
Expected: PASS for all 370+ tests.

- [ ] **Step 7: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add src/integrations/llm/claude-agent-runner.ts tests/integrations/llm/claude-agent-runner.test.ts
git commit -m "feat(claude-runner): lazy API key check + backend field in token log"
```

---

## Task 3: Codex agent runner — happy path

**Files:**
- Create: `src/integrations/llm/codex-agent-runner.ts`
- Test: `tests/integrations/llm/codex-agent-runner.test.ts`

테스트 가능성을 위해 외부에 노출하는 주입점은 `callCodex` 함수 (subprocess 추상). 기본 구현은 `node:child_process.spawn` + tmpfile, 테스트는 `callCodex` mock 으로 spawn 회피.

- [ ] **Step 1: Write happy-path test**

`tests/integrations/llm/codex-agent-runner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

```sh
bun run test tests/integrations/llm/codex-agent-runner.test.ts
```
Expected: FAIL — `Cannot find module .../codex-agent-runner`.

- [ ] **Step 3: Implement minimal codex-agent-runner.ts**

`src/integrations/llm/codex-agent-runner.ts`:

```ts
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentPort, AgentContract } from "../../core/agents/ports";
import { loadSystemPrompt } from "./system-prompt-loader";
import { stripMarkdownFences } from "./util";

export interface CodexCallArgs {
  prompt: string;
  model?: string;
  codexBin: string;
}

export interface CodexCallResult {
  exitCode: number;
  stderr: string;
  lastMessage: string;
}

export type CallCodexFn = (args: CodexCallArgs) => Promise<CodexCallResult>;

export interface CodexAgentRunnerConfig<I, O> {
  contract: AgentContract<I, O>;
  name: string;
  model?: string;
  codexBin?: string;
  maxRetries?: number;
  tokenLogPath?: string;
  /** Test injection — replaces real subprocess invocation. */
  callCodex?: CallCodexFn;
  loadSystemPrompt?: (p: string) => Promise<string>;
  repoRoot?: string;
}

const DEFAULT_CODEX_BIN = "codex";
const DEFAULT_MAX_RETRIES = 1;

export function makeCodexAgentRunner<I, O>(
  config: CodexAgentRunnerConfig<I, O>
): AgentPort<I, O> {
  const {
    contract,
    name,
    model = process.env.CARDNEWS_CODEX_MODEL,
    codexBin = DEFAULT_CODEX_BIN,
    maxRetries = DEFAULT_MAX_RETRIES,
    tokenLogPath,
    repoRoot,
  } = config;

  const callCodex = config.callCodex ?? defaultCallCodex;
  const loadPrompt = config.loadSystemPrompt
    ? config.loadSystemPrompt
    : (p: string) => loadSystemPrompt(p, { repoRoot });

  return {
    name,
    contract,
    async run(input: I): Promise<O> {
      const validatedInput = contract.inputSchema.parse(input);
      const systemPrompt = await loadPrompt(contract.systemPromptPath);

      const prompt = [
        systemPrompt,
        "",
        "Here is the input to process:",
        "```json",
        JSON.stringify(validatedInput),
        "```",
        "",
        "Return ONLY a JSON object matching the output schema.",
      ].join("\n");

      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await callCodex({ prompt, model, codexBin });

        if (result.exitCode !== 0) {
          const tail = (result.stderr || "").slice(-500);
          throw new Error(`Codex CLI failed (exit ${result.exitCode}): ${tail}`);
        }

        if (!result.lastMessage || result.lastMessage.trim() === "") {
          throw new Error("Codex returned empty response");
        }

        const jsonStr = stripMarkdownFences(result.lastMessage);

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          const err = new Error(
            `Failed to parse JSON response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}.\n` +
              `Response snippet: ${jsonStr.substring(0, 200)}`
          );
          if (attempt < maxRetries) {
            lastError = err;
            continue;
          }
          throw err;
        }

        try {
          const output = contract.outputSchema.parse(parsed);
          await logTokenUsage(
            {
              agent: name,
              model: `codex:${model ?? "default"}`,
              attempt,
              input_tokens: null,
              output_tokens: null,
              cache_read: 0,
              cache_create: 0,
              backend: "codex",
            },
            tokenLogPath
          );
          return output;
        } catch (zodErr) {
          if (attempt < maxRetries) {
            lastError = zodErr instanceof Error ? zodErr : new Error(String(zodErr));
            continue;
          }
          throw zodErr;
        }
      }

      throw lastError ?? new Error(`Codex runner failed after ${maxRetries} attempts`);
    },
  };
}

async function defaultCallCodex(args: CodexCallArgs): Promise<CodexCallResult> {
  const { prompt, model, codexBin } = args;
  const tmpFile = path.join(os.tmpdir(), `cardnews-codex-${randomUUID()}.txt`);
  const cliArgs = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--ephemeral",
    "-s",
    "read-only",
    "--output-last-message",
    tmpFile,
  ];
  if (model) cliArgs.push("--model", model);
  cliArgs.push("-"); // read prompt from stdin

  return new Promise<CodexCallResult>((resolve, reject) => {
    let stderrBuf = "";
    let child;
    try {
      child = spawn(codexBin, cliArgs, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        reject(new Error("codex CLI not found. Install via brew install codex"));
        return;
      }
      reject(err);
      return;
    }

    child.on("error", (err) => {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        reject(new Error("codex CLI not found. Install via brew install codex"));
      } else {
        reject(err);
      }
    });

    child.stderr?.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf8");
    });
    child.stdout?.on("data", () => {
      // drain — events are consumed via --output-last-message
    });

    child.stdin?.write(prompt);
    child.stdin?.end();

    child.on("exit", async (code) => {
      let lastMessage = "";
      try {
        lastMessage = await fs.readFile(tmpFile, "utf8");
      } catch {
        // missing tmpfile is treated as empty response
      } finally {
        await fs.rm(tmpFile, { force: true }).catch(() => {});
      }
      resolve({
        exitCode: code ?? -1,
        stderr: stderrBuf,
        lastMessage,
      });
    });
  });
}

async function logTokenUsage(
  record: {
    agent: string;
    model: string;
    attempt: number;
    input_tokens: number | null;
    output_tokens: number | null;
    cache_read: number;
    cache_create: number;
    backend: "codex";
  },
  tokenLogPath?: string
): Promise<void> {
  if (!tokenLogPath) return;
  const line = JSON.stringify({
    agent: record.agent,
    ts: new Date().toISOString(),
    model: record.model,
    attempt: record.attempt,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens,
    cache_read: record.cache_read,
    cache_create: record.cache_create,
    backend: record.backend,
  });
  try {
    const tokensFile = path.join(tokenLogPath, ".tokens.jsonl");
    await fs.mkdir(tokenLogPath, { recursive: true });
    await fs.appendFile(tokensFile, line + "\n");
  } catch (err) {
    console.error(
      `Failed to log token usage: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
```

- [ ] **Step 4: Run test — verify happy path passes**

```sh
bun run test tests/integrations/llm/codex-agent-runner.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add src/integrations/llm/codex-agent-runner.ts tests/integrations/llm/codex-agent-runner.test.ts
git commit -m "feat(codex-runner): add happy path with subprocess injection point"
```

---

## Task 4: Codex agent runner — error handling

**Files:**
- Modify: `tests/integrations/llm/codex-agent-runner.test.ts`
- (`codex-agent-runner.ts` already implements these — tests confirm behavior)

- [ ] **Step 1: Add failing tests**

Append to `tests/integrations/llm/codex-agent-runner.test.ts` inside the existing `describe`:

```ts
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
```

- [ ] **Step 2: Run tests to verify pass**

The error paths are already implemented in Task 3's runner. Tests should PASS immediately:

```sh
bun run test tests/integrations/llm/codex-agent-runner.test.ts
```
Expected: PASS (8 tests total).

- [ ] **Step 3: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add tests/integrations/llm/codex-agent-runner.test.ts
git commit -m "test(codex-runner): cover non-zero exit, empty, parse, zod errors"
```

---

## Task 5: Codex agent runner — token logging

**Files:**
- Test: `tests/integrations/llm/codex-agent-runner.test.ts`

- [ ] **Step 1: Add failing test**

Append inside `describe("codex-agent-runner", ...)`:

```ts
  it("writes token log entry with backend: 'codex' and null token counts", async () => {
    const tmpDir = await fs.mkdtemp(path.join(import.meta.dirname, "tmp-codex-tokens-"));
    try {
      const callCodex = vi.fn().mockResolvedValue({
        exitCode: 0,
        stderr: "",
        lastMessage: '{"foo":"ok"}',
      });
      const runner = makeCodexAgentRunner({
        contract: mockContract,
        name: "codey",
        callCodex,
        tokenLogPath: tmpDir,
      });
      await runner.run({ prompt: "x" });

      const log = await fs.readFile(path.join(tmpDir, ".tokens.jsonl"), "utf8");
      const lastLine = log.trim().split("\n").pop()!;
      const parsed = JSON.parse(lastLine);
      expect(parsed.backend).toBe("codex");
      expect(parsed.agent).toBe("codey");
      expect(parsed.input_tokens).toBeNull();
      expect(parsed.output_tokens).toBeNull();
      expect(parsed.model).toMatch(/^codex:/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run — should PASS already**

Token logging is implemented in Task 3. Verify:

```sh
bun run test tests/integrations/llm/codex-agent-runner.test.ts
```
Expected: PASS (9 tests).

- [ ] **Step 3: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add tests/integrations/llm/codex-agent-runner.test.ts
git commit -m "test(codex-runner): verify backend-tagged token log with null counts"
```

---

## Task 6: Dual agent runner — base passthrough + credit fallback

**Files:**
- Create: `src/integrations/llm/dual-agent-runner.ts`
- Test: `tests/integrations/llm/dual-agent-runner.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/integrations/llm/dual-agent-runner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

```sh
bun run test tests/integrations/llm/dual-agent-runner.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement dual-agent-runner.ts**

`src/integrations/llm/dual-agent-runner.ts`:

```ts
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
    msg.includes("credit balance is too low")
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```sh
bun run test tests/integrations/llm/dual-agent-runner.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add src/integrations/llm/dual-agent-runner.ts tests/integrations/llm/dual-agent-runner.test.ts
git commit -m "feat(dual-runner): claude→codex auto fallback with shared latch"
```

---

## Task 7: Public API exports

**Files:**
- Modify: `src/integrations/llm/index.ts`

- [ ] **Step 1: Update index.ts**

Replace the contents of `src/integrations/llm/index.ts` with:

```ts
export { makeClaudeAgentRunner } from "./claude-agent-runner";
export type { ClaudeAgentRunnerConfig } from "./claude-agent-runner";

export { makeCodexAgentRunner } from "./codex-agent-runner";
export type {
  CodexAgentRunnerConfig,
  CodexCallArgs,
  CodexCallResult,
  CallCodexFn,
} from "./codex-agent-runner";

export { makeDualAgentRunner } from "./dual-agent-runner";
export type {
  DualAgentRunnerConfig,
  FallbackLatch,
} from "./dual-agent-runner";

export { stripMarkdownFences } from "./util";

export { loadSystemPrompt, clearSystemPromptCache } from "./system-prompt-loader";

export {
  loadBaseline,
  compareToBaseline,
  renderComparisonReport,
} from "./baseline-comparison";
export type {
  BaselineMeta,
  ComparisonAxis,
  BaselineComparison,
  Score,
} from "./baseline-comparison";
```

- [ ] **Step 2: Run typecheck**

```sh
bun run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add src/integrations/llm/index.ts
git commit -m "feat(llm): export codex-runner, dual-runner, util"
```

---

## Task 8: m2-first-v2.ts wire-up

**Files:**
- Modify: `scripts/m2-first-v2.ts`

기존 4개 `makeClaudeAgentRunner(...)` 호출을 dual runner 로 래핑한다. 공유 latch 1개를 만들어 4개 모두에 주입.

- [ ] **Step 1: Locate existing runner construction**

Find the section in `scripts/m2-first-v2.ts` where the 4 runners are built. Search:

```sh
grep -n "makeClaudeAgentRunner" scripts/m2-first-v2.ts
```

Note the exact line numbers and surrounding context.

- [ ] **Step 2: Add imports**

At the top of `scripts/m2-first-v2.ts` (replace existing line 33 import):

```ts
import { makeClaudeAgentRunner } from "../src/integrations/llm/claude-agent-runner";
import { makeCodexAgentRunner } from "../src/integrations/llm/codex-agent-runner";
import {
  makeDualAgentRunner,
  type FallbackLatch,
} from "../src/integrations/llm/dual-agent-runner";
```

- [ ] **Step 3: Replace runner construction block (lines 254-304)**

Replace the entire block from `// ---- Build real agent runners ----` through the closing `});` of `factChecker` with:

```ts
  // ---- Build real agent runners (Claude primary, Codex fallback) ----
  const tokenLogPath = cardDir; // .tokens.jsonl appended here
  const fallbackLatch: FallbackLatch = { tripped: false };

  const analyst = makeDualAgentRunner<AnalystInput, AnalystOutput>({
    claude: makeClaudeAgentRunner<AnalystInput, AnalystOutput>({
      contract: {
        inputSchema: AnalystInputSchema,
        outputSchema: AnalystOutputSchema,
        systemPromptPath: "data/agents/analyst.md",
      },
      name: "analyst",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<AnalystInput, AnalystOutput>({
      contract: {
        inputSchema: AnalystInputSchema,
        outputSchema: AnalystOutputSchema,
        systemPromptPath: "data/agents/analyst.md",
      },
      name: "analyst",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const copywriter = makeDualAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
    claude: makeClaudeAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
      contract: {
        inputSchema: CopywriterPageInputSchema,
        outputSchema: CopywriterPageOutputSchema,
        systemPromptPath: "data/agents/copywriter.md",
      },
      name: "copywriter",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<CopywriterPageInput, CopywriterPageOutput>({
      contract: {
        inputSchema: CopywriterPageInputSchema,
        outputSchema: CopywriterPageOutputSchema,
        systemPromptPath: "data/agents/copywriter.md",
      },
      name: "copywriter",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const imageDirector = makeDualAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
    claude: makeClaudeAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
      contract: {
        inputSchema: ImageDirectorInputSchema,
        outputSchema: ImageDirectorOutputSchema,
        systemPromptPath: "data/agents/image-director.md",
      },
      name: "image-director",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<ImageDirectorInput, ImageDirectorOutput>({
      contract: {
        inputSchema: ImageDirectorInputSchema,
        outputSchema: ImageDirectorOutputSchema,
        systemPromptPath: "data/agents/image-director.md",
      },
      name: "image-director",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });

  const factChecker = makeDualAgentRunner<FactCheckerInput, FactCheckerOutput>({
    claude: makeClaudeAgentRunner<FactCheckerInput, FactCheckerOutput>({
      contract: {
        inputSchema: FactCheckerInputSchema,
        outputSchema: FactCheckerOutputSchema,
        systemPromptPath: "data/agents/fact-checker.md",
      },
      name: "fact-checker",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    codex: makeCodexAgentRunner<FactCheckerInput, FactCheckerOutput>({
      contract: {
        inputSchema: FactCheckerInputSchema,
        outputSchema: FactCheckerOutputSchema,
        systemPromptPath: "data/agents/fact-checker.md",
      },
      name: "fact-checker",
      tokenLogPath,
      repoRoot: projectRoot,
    }),
    latch: fallbackLatch,
  });
```

- [ ] **Step 4: Run typecheck**

```sh
bun run typecheck
```
Expected: no errors.

- [ ] **Step 5: Run full test suite**

```sh
bun run test
```
Expected: PASS for all tests (including new ones from Tasks 1, 2, 3-5, 6).

- [ ] **Step 6: Commit**

```sh
cd /Users/jasonmac/claude_ai/cardnews
git add scripts/m2-first-v2.ts
git commit -m "feat(m2): wrap 4 agents with dual runner + shared fallback latch"
```

---

## Task 9: Manual verification

**Files:** none (sanity check)

- [ ] **Step 1: Sanity — current script invocation still works (no key path)**

Run without ANTHROPIC_API_KEY (Codex only — latch should flip on the very first call):

```sh
unset ANTHROPIC_API_KEY
bun run m2:first-v2 "Codex only smoke" --no-image 2>&1 | tail -40
```

Expected: pipeline progresses past `pipeline.start ...`. First Claude call throws "ANTHROPIC_API_KEY env var not set" → dual runner catches → latch flips → Codex runs.

If codex returns valid JSON, pipeline proceeds. If codex fails (e.g. login expired), the error message will surface as "Codex CLI failed: ...".

- [ ] **Step 2: Inspect token log if a card was created**

```sh
ls /Users/jasonmac/claude_ai/cardnews/data/series/claude/cards/ | tail -3
# pick the latest cardId, then:
cat "/Users/jasonmac/claude_ai/cardnews/data/series/claude/cards/<cardId>/.tokens.jsonl"
```

Expected: every line has `"backend":"codex"` (latch was tripped from the start).

- [ ] **Step 3: Confirm 'ANTHROPIC_API_KEY env var not set' error does NOT escape the runner**

Confirm that the error from Step 1 was caught by dual runner (not raised). Look for `[dual-runner] switching to Codex` log line in stderr.

If it didn't switch (the error escaped), check `dual-agent-runner.ts:isCreditExhausted` — the lazy key error message must include "ANTHROPIC_API_KEY" but NOT "credit_balance_too_low". This is a known-but-acceptable gap: the lazy key error is **not** a credit error, so latch doesn't flip on it.

**Resolution:** if running without a key is required, extend `isCreditExhausted` to also match `/ANTHROPIC_API_KEY/`. Add a follow-up commit:

In `src/integrations/llm/dual-agent-runner.ts`, replace `isCreditExhausted`:

```ts
function isCreditExhausted(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("credit_balance_too_low") ||
    msg.includes("credit balance is too low") ||
    msg.includes("anthropic_api_key env var not set")
  );
}
```

Add a corresponding test in `tests/integrations/llm/dual-agent-runner.test.ts`:

```ts
  it("flips latch when claude throws because ANTHROPIC_API_KEY is missing", async () => {
    const claude = makeFakeRunner("claude", async () => {
      throw new Error("ANTHROPIC_API_KEY env var not set. Run `export ANTHROPIC_API_KEY=...` ...");
    });
    const codex = makeFakeRunner("codex", async () => ({ r: "ok" }));
    const latch: FallbackLatch = { tripped: false };
    const dual = makeDualAgentRunner({ claude, codex, latch });
    const result = await dual.run({ p: "x" });
    expect(result).toEqual({ r: "ok" });
    expect(latch.tripped).toBe(true);
  });
```

Run test, fix code (already shown), re-run, commit:

```sh
bun run test tests/integrations/llm/dual-agent-runner.test.ts
git add src/integrations/llm/dual-agent-runner.ts tests/integrations/llm/dual-agent-runner.test.ts
git commit -m "feat(dual-runner): treat missing ANTHROPIC_API_KEY as fallback trigger"
```

- [ ] **Step 4: Final full-suite run**

```sh
bun run typecheck && bun run test
```
Expected: typecheck clean, all tests pass.

---

## Done

After Task 9 finishes:

- ✅ Anthropic 잔액 있을 때: 기존과 동일하게 Claude 만 사용 (token log `backend: "claude"`)
- ✅ Anthropic 잔액 없을 때: 첫 호출에서 latch flip → 나머지 호출 모두 Codex (`backend: "codex"`)
- ✅ ANTHROPIC_API_KEY 미설정: 첫 호출에서 latch flip → 전체 Codex
- ✅ Codex 실패 시: stderr 발췌가 포함된 에러로 사용자에게 노출
