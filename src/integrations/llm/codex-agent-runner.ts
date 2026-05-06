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
