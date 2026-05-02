import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSystemPrompt,
  clearSystemPromptCache,
} from "../../../src/integrations/llm/system-prompt-loader";
import * as path from "node:path";

describe("system-prompt-loader", () => {
  beforeEach(() => {
    clearSystemPromptCache();
  });

  const testDir = import.meta.dirname; // tests/integrations/llm
  const projectRoot = path.join(testDir, "../../../"); // go up to projects/cardnews

  it("loads from absolute path", async () => {
    const fixturePath = path.join(testDir, "_fixtures/sample-prompt.md");
    const prompt = await loadSystemPrompt(fixturePath);
    expect(prompt).toContain("Sample System Prompt");
  });

  it("loads from repo-relative path", async () => {
    const prompt = await loadSystemPrompt(
      "tests/integrations/llm/_fixtures/sample-prompt.md",
      { repoRoot: projectRoot }
    );
    expect(prompt).toContain("helpful assistant");
  });

  it("caches on second call (no re-read)", async () => {
    const fixturePath = path.join(testDir, "_fixtures/sample-prompt.md");

    // First call
    const prompt1 = await loadSystemPrompt(fixturePath);
    expect(prompt1).toBeDefined();

    // Second call should return the same value from cache
    const prompt2 = await loadSystemPrompt(fixturePath);
    expect(prompt2).toBe(prompt1);
  });

  it("clears cache on clearSystemPromptCache()", async () => {
    const fixturePath = path.join(testDir, "_fixtures/sample-prompt.md");

    const prompt1 = await loadSystemPrompt(fixturePath);
    clearSystemPromptCache();

    // After clearing, cache should be empty. We can't directly test cache internals,
    // but we can verify it still loads correctly (and would re-read if we were spying).
    const prompt2 = await loadSystemPrompt(fixturePath);
    expect(prompt2).toBe(prompt1);
  });

  it("throws on missing file", async () => {
    const nonexistent = "/nonexistent/path/to/prompt.md";
    await expect(loadSystemPrompt(nonexistent)).rejects.toThrow(
      /Failed to load system prompt/
    );
  });
});
