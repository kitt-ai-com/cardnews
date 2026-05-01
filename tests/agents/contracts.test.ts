import { describe, it, expect } from "vitest";
import {
  AnalystInputSchema,
  AnalystOutputSchema,
} from "../../src/core/agents/contracts/analyst";
import { CopywriterPageOutputSchema } from "../../src/core/agents/contracts/copywriter";
import { ImageDirectorOutputSchema } from "../../src/core/agents/contracts/image-director";
import { FactCheckerOutputSchema } from "../../src/core/agents/contracts/fact-checker";

describe("Analyst contract", () => {
  it("rejects empty input and output", () => {
    expect(() => AnalystInputSchema.parse({})).toThrow();
    expect(() => AnalystOutputSchema.parse({})).toThrow();
  });

  it("accepts valid output with cover/2 body/cta pages", () => {
    const valid = {
      coreMessage: "Card news teaches a single insight",
      hookStrategy: "Open with a relatable pain point",
      flow: "cover -> P1 -> P2 -> cta",
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          workingTitle: "Hook title",
          message: "Why this matters",
          mappingNote: "Lead with the pain",
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          workingTitle: "Body 1",
          message: "First insight",
          mappingNote: "Explain the cause",
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          workingTitle: "Body 2",
          message: "Second insight",
          mappingNote: "Show the contrast",
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          workingTitle: "CTA",
          message: "Take action",
          mappingNote: "Direct ask",
        },
      ],
    };
    expect(() => AnalystOutputSchema.parse(valid)).not.toThrow();
  });
});

describe("Copywriter contract", () => {
  it("rejects empty title and accepts valid title", () => {
    expect(() =>
      CopywriterPageOutputSchema.parse({ copy: { title: "" } }),
    ).toThrow();
    expect(() =>
      CopywriterPageOutputSchema.parse({ copy: { title: "Hello" } }),
    ).not.toThrow();
  });
});

describe("ImageDirector contract", () => {
  it("accepts a minimal valid prompt", () => {
    expect(() =>
      ImageDirectorOutputSchema.parse({
        prompt: { text: "abstract", size: "1024x1536" },
      }),
    ).not.toThrow();
  });
});

describe("FactChecker contract", () => {
  it("rejects invalid status enum", () => {
    expect(() =>
      FactCheckerOutputSchema.parse({
        claims: [
          { claim: "x", status: "bogus", reason: "r" },
        ],
      }),
    ).toThrow();
  });

  it("accepts a confirmed claim", () => {
    expect(() =>
      FactCheckerOutputSchema.parse({
        claims: [
          { claim: "Earth orbits the Sun", status: "confirmed", reason: "Well-established" },
        ],
      }),
    ).not.toThrow();
  });
});
