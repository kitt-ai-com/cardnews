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
