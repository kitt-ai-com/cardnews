import Anthropic from "@anthropic-ai/sdk";
import type { AgentPort, AgentContract } from "../../core/agents/ports";
import type { ZodType } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadSystemPrompt, clearSystemPromptCache } from "./system-prompt-loader";
import { stripMarkdownFences } from "./util";

export interface ClaudeAgentRunnerConfig<I, O> {
  contract: AgentContract<I, O>;
  name: string; // "analyst" | "copywriter" | "image-director" | "fact-checker"
  model?: string; // default "claude-opus-4-7"
  maxRetries?: number; // default 3
  maxTokens?: number; // default 8192
  client?: Anthropic; // injectable for tests
  tokenLogPath?: string; // absolute or repo-relative dir
  repoRoot?: string; // for testing
  loadSystemPrompt?: (path: string) => Promise<string>; // injectable for tests
}

const DEFAULT_MODEL = "claude-opus-4-7";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_TOKENS = 8192;

/**
 * Create an AgentPort<I, O> backed by the Anthropic SDK.
 * Handles system prompt loading, caching, prompt caching, retries, and token logging.
 */
export function makeClaudeAgentRunner<I, O>(
  config: ClaudeAgentRunnerConfig<I, O>
): AgentPort<I, O> {
  const {
    contract,
    name,
    model = DEFAULT_MODEL,
    maxRetries = DEFAULT_MAX_RETRIES,
    maxTokens = DEFAULT_MAX_TOKENS,
    tokenLogPath,
    repoRoot,
  } = config;

  // Ensure we have a client or can create one
  let client = config.client;
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY env var not set. Run `export ANTHROPIC_API_KEY=...` or pass a client to makeClaudeAgentRunner."
      );
    }
    client = new Anthropic({ apiKey });
  }

  const customLoadPrompt = config.loadSystemPrompt
    ? config.loadSystemPrompt
    : (p: string) => loadSystemPrompt(p, { repoRoot });

  const runner: AgentPort<I, O> = {
    name,
    contract,
    async run(input: I): Promise<O> {
      // Validate input
      const validatedInput = contract.inputSchema.parse(input);

      // Load system prompt
      const systemPrompt = await customLoadPrompt(contract.systemPromptPath);

      // Build system blocks with cache_control
      const systemBlocks: Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }> = [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Here is the input to process:\n\`\`\`json\n${JSON.stringify(validatedInput)}\n\`\`\`\n\nReturn ONLY a JSON object matching the output schema.`,
          cache_control: { type: "ephemeral" },
        },
      ];

      let lastError: Error | undefined;

      // Retry loop
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemBlocks as any,
            messages: [{ role: "user", content: "Begin." }],
          });

          // Extract response text
          const responseText = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("");

          // Strip markdown code fences
          const jsonStr = stripMarkdownFences(responseText);

          // Parse JSON
          let parsed: unknown;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (parseErr) {
            throw new Error(
              `Failed to parse JSON response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}.\n` +
                `Response snippet: ${jsonStr.substring(0, 200)}`
            );
          }

          // Validate against output schema
          const result = contract.outputSchema.parse(parsed);

          // Log token usage
          if (response.usage) {
            await logTokenUsage(
              {
                agent: name,
                model,
                attempt,
                input_tokens: response.usage.input_tokens,
                output_tokens: response.usage.output_tokens,
                cache_read: response.usage.cache_read_input_tokens || 0,
                cache_create: response.usage.cache_creation_input_tokens || 0,
              },
              tokenLogPath
            );
          }

          return result;
        } catch (err) {
          // Check if it's an APIError-like object (works with both real and mocked)
          const statusCode = getErrorStatusCode(err);

          // Determine if we should retry
          const shouldRetry =
            statusCode === 429 || // Rate limit
            (statusCode && statusCode >= 500) || // Server error
            (err instanceof Error && isNetworkError(err)); // Network error

          if (shouldRetry && attempt < maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            lastError = err instanceof Error ? err : new Error(String(err));
            continue;
          }

          // Not retrying — map error to user-friendly message
          if (statusCode === 401) {
            throw new Error("Anthropic API auth failed. Check ANTHROPIC_API_KEY.");
          } else if (statusCode === 404) {
            throw new Error(
              `Claude model '${model}' not available. Try 'claude-opus-4-7'.`
            );
          } else if (statusCode && statusCode >= 400) {
            throw new Error(
              `Claude API error (${statusCode}): ${err instanceof Error ? err.message : String(err)}`
            );
          }

          throw err;
        }
      }

      // If we got here, we exhausted retries
      throw lastError || new Error(`Failed after ${maxRetries} attempts`);
    },
  };

  return runner;
}

/**
 * Extract status code from an error (works with real Anthropic.APIError or mocked versions).
 */
function getErrorStatusCode(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    return (err as any).status;
  }
  return null;
}


/**
 * Check if an error is a network error (Node.js ErrnoException).
 */
function isNetworkError(err: Error): boolean {
  const nodeErr = err as NodeJS.ErrnoException;
  return (
    nodeErr.code === "ECONNRESET" ||
    nodeErr.code === "ETIMEDOUT" ||
    nodeErr.code === "ENOTFOUND" ||
    nodeErr.code === "ECONNREFUSED"
  );
}

/**
 * Log token usage to a JSONL file.
 */
async function logTokenUsage(
  record: {
    agent: string;
    model: string;
    attempt: number;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_create: number;
  },
  tokenLogPath?: string
): Promise<void> {
  if (!tokenLogPath) {
    return; // No logging if path not provided
  }

  const line = JSON.stringify({
    agent: record.agent,
    ts: new Date().toISOString(),
    model: record.model,
    attempt: record.attempt,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens,
    cache_read: record.cache_read,
    cache_create: record.cache_create,
  });

  try {
    const tokensFile = path.join(tokenLogPath, ".tokens.jsonl");
    await fs.mkdir(tokenLogPath, { recursive: true });
    await fs.appendFile(tokensFile, line + "\n");
  } catch (err) {
    // Silently fail token logging (don't block the agent)
    console.error(
      `Failed to log token usage: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
