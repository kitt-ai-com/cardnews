import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const projectRoot = path.join(import.meta.dirname, "../../../");

interface PromptCase {
  file: string;
  expectedTerms: string[];
}

// Sanity checks: each agent prompt exists, is non-empty, and mentions
// the load-bearing concepts the contract demands. These are NOT prompt
// quality tests — they catch the file going missing or being truncated.
const cases: PromptCase[] = [
  {
    file: "data/agents/analyst.md",
    expectedTerms: ["Claim Ledger", "thesis", "audienceQuestion", "narrativeArc", "copyIntent"],
  },
  {
    file: "data/agents/copywriter.md",
    expectedTerms: ["copyIntent", "committedClaimIds", "ledgerSlice", "<accent>", "forbiddenRepeats"],
  },
  {
    file: "data/agents/image-director.md",
    expectedTerms: [
      "no text, no letters, no characters",
      "preset.imageStyle",
      "vertical 1080x1350 composition",
      "infoPattern",
      "skipReason",
    ],
  },
  {
    file: "data/agents/fact-checker.md",
    expectedTerms: ["confirmed", "uncertain", "conflicting", "sourceHint", "Korean"],
  },
];

describe("agent system prompts", () => {
  const loaded = new Map<string, string>();

  beforeAll(async () => {
    for (const c of cases) {
      const abs = path.join(projectRoot, c.file);
      loaded.set(c.file, await fs.readFile(abs, "utf-8"));
    }
  });

  for (const c of cases) {
    describe(c.file, () => {
      it("exists and is substantial (>500 chars)", () => {
        const text = loaded.get(c.file)!;
        expect(text).toBeDefined();
        expect(text.length).toBeGreaterThan(500);
      });

      for (const term of c.expectedTerms) {
        it(`mentions "${term}"`, () => {
          const text = loaded.get(c.file)!;
          expect(text).toContain(term);
        });
      }
    });
  }
});
