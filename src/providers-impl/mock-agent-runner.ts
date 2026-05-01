import type { AgentPort } from "@core/agents/ports";
import {
  AnalystInputSchema,
  AnalystOutputSchema,
  type AnalystInput,
  type AnalystOutput,
} from "@core/agents/contracts/analyst";
import {
  CopywriterPageInputSchema,
  CopywriterPageOutputSchema,
  type CopywriterPageInput,
  type CopywriterPageOutput,
} from "@core/agents/contracts/copywriter";
import {
  ImageDirectorInputSchema,
  ImageDirectorOutputSchema,
  type ImageDirectorInput,
  type ImageDirectorOutput,
} from "@core/agents/contracts/image-director";
import {
  FactCheckerInputSchema,
  FactCheckerOutputSchema,
  type FactCheckerInput,
  type FactCheckerOutput,
} from "@core/agents/contracts/fact-checker";
import { slideCountRange } from "@core/validators/structure";
import type { LayoutId } from "@core/schemas/preset";

const LIST_LAYOUTS: ReadonlySet<LayoutId> = new Set(["P3", "P5"]);

export function makeMockAnalyst(): AgentPort<AnalystInput, AnalystOutput> {
  return {
    name: "mock-analyst",
    contract: {
      inputSchema: AnalystInputSchema,
      outputSchema: AnalystOutputSchema,
      systemPromptPath: "data/agents/analyst.md",
    },
    async run(input: AnalystInput): Promise<AnalystOutput> {
      const sourceTextLength = (input.sourceText ?? input.topic ?? "").length;
      const range = slideCountRange(sourceTextLength);
      const target = Math.max(range.min, 4);

      // Filter out cover/cta from preset.layouts to find body candidates.
      let bodyCandidates = input.preset.layouts.filter(
        (l) => l !== "cover" && l !== "cta"
      );

      if (bodyCandidates.length === 0) {
        bodyCandidates = ["P1", "P2"];
      } else if (bodyCandidates.length === 1) {
        const only = bodyCandidates[0];
        const partner: LayoutId = only === "P1" ? "P2" : "P1";
        bodyCandidates = [only, partner];
      }

      const bodyCount = target - 2;
      const pages: AnalystOutput["pages"] = [];

      // Cover at index 1
      pages.push({
        index: 1,
        role: "cover",
        layout: "cover",
        workingTitle: "Cover",
        message: "Mock cover message",
        mappingNote: "cover layout overlay",
      });

      // Body pages — alternate across bodyCandidates
      for (let i = 0; i < bodyCount; i++) {
        const layout = bodyCandidates[i % bodyCandidates.length];
        pages.push({
          index: pages.length + 1,
          role: "body",
          layout,
          workingTitle: `Body ${i + 1}`,
          message: `Mock body message ${i + 1}`,
          mappingNote: `body mapping ${i + 1}`,
        });
      }

      // CTA at last index
      pages.push({
        index: pages.length + 1,
        role: "cta",
        layout: "cta",
        workingTitle: "CTA",
        message: "Mock CTA message",
        mappingNote: "cta layout overlay",
      });

      const out: AnalystOutput = {
        coreMessage: "Mock core for: " + (input.topic ?? "input"),
        hookStrategy: "shock + curiosity",
        flow: "intro → points → close",
        pages,
      };

      return AnalystOutputSchema.parse(out);
    },
  };
}

export function makeMockCopywriter(): AgentPort<
  CopywriterPageInput,
  CopywriterPageOutput
> {
  return {
    name: "mock-copywriter",
    contract: {
      inputSchema: CopywriterPageInputSchema,
      outputSchema: CopywriterPageOutputSchema,
      systemPromptPath: "data/agents/copywriter.md",
    },
    async run(input: CopywriterPageInput): Promise<CopywriterPageOutput> {
      const { page } = input;
      const title = `${page.workingTitle} <accent>맥락</accent>`;

      let copy: CopywriterPageOutput["copy"];

      if (page.role === "cover" || page.role === "cta") {
        copy = { title };
      } else if (LIST_LAYOUTS.has(page.layout)) {
        copy = {
          title,
          list: [
            "첫 번째 항목으로 시작한다.",
            "두 번째 항목은 맥락을 더한다.",
            "세 번째 항목으로 마무리한다.",
          ],
        };
      } else {
        copy = {
          title,
          body:
            "첫 번째 문장으로 시작한다. 두 번째 문장은 맥락을 더한다. 세 번째 문장으로 마무리한다.",
        };
      }

      const out: CopywriterPageOutput = { copy };
      return CopywriterPageOutputSchema.parse(out);
    },
  };
}

export function makeMockImageDirector(): AgentPort<
  ImageDirectorInput,
  ImageDirectorOutput
> {
  return {
    name: "mock-image-director",
    contract: {
      inputSchema: ImageDirectorInputSchema,
      outputSchema: ImageDirectorOutputSchema,
      systemPromptPath: "data/agents/image-director.md",
    },
    async run(input: ImageDirectorInput): Promise<ImageDirectorOutput> {
      const { page, preset } = input;
      let out: ImageDirectorOutput;

      if (LIST_LAYOUTS.has(page.layout)) {
        out = {
          prompt: { text: "noop", size: "1024x1024" },
          skipReason: `layout ${page.layout} does not need an image`,
        };
      } else {
        out = {
          prompt: {
            text:
              "Abstract minimal background, " +
              preset.imageStyle +
              ", no text, no letters, leave bottom 40% empty for overlay text",
            size: "1024x1536",
          },
        };
      }

      return ImageDirectorOutputSchema.parse(out);
    },
  };
}

export function makeMockFactChecker(): AgentPort<
  FactCheckerInput,
  FactCheckerOutput
> {
  return {
    name: "mock-fact-checker",
    contract: {
      inputSchema: FactCheckerInputSchema,
      outputSchema: FactCheckerOutputSchema,
      systemPromptPath: "data/agents/fact-checker.md",
    },
    async run(input: FactCheckerInput): Promise<FactCheckerOutput> {
      const out: FactCheckerOutput = {
        claims: [
          {
            claim: input.topic ?? "input",
            status: "confirmed",
            reason: "mock runner returns confirmed by default",
          },
        ],
      };
      return FactCheckerOutputSchema.parse(out);
    },
  };
}
