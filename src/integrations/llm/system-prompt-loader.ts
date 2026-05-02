import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";

const promptCache = new Map<string, string>();

/**
 * Detect the repo root by walking up from cwd looking for package.json with
 * "name": "@design-agent/cardnews". Fall back to process.cwd().
 */
function findRepoRoot(): string {
  let current = process.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    try {
      const pkgPath = path.join(current, "package.json");
      const content = fsSync.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.name === "@design-agent/cardnews") {
        return current;
      }
    } catch {
      // Not a package.json or not the right one
    }
    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root
      break;
    }
    current = parent;
    depth++;
  }

  return process.cwd();
}

/**
 * Load a system prompt from disk. Caches by path to avoid re-reading.
 * Resolves relative paths against the repo root (if not absolute).
 *
 * @param promptPath Absolute path or repo-relative path (e.g., "data/agents/analyst.md")
 * @param opts Optional configuration (repoRoot for testing)
 * @returns The prompt text (UTF-8)
 * @throws If file not found or read fails
 */
export async function loadSystemPrompt(
  promptPath: string,
  opts?: { repoRoot?: string }
): Promise<string> {
  // Check cache
  if (promptCache.has(promptPath)) {
    return promptCache.get(promptPath)!;
  }

  // Resolve the path
  let resolvedPath: string;
  if (path.isAbsolute(promptPath)) {
    resolvedPath = promptPath;
  } else {
    const repoRoot = opts?.repoRoot ?? findRepoRoot();
    resolvedPath = path.join(repoRoot, promptPath);
  }

  // Read and cache
  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    promptCache.set(promptPath, content);
    return content;
  } catch (err) {
    throw new Error(
      `Failed to load system prompt from ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Clear the system prompt cache (useful for testing).
 */
export function clearSystemPromptCache(): void {
  promptCache.clear();
}
