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
