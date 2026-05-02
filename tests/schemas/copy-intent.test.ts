import { describe, expect, it } from "vitest";
import { CopyIntent } from "@core/schemas/copy-intent";

describe("CopyIntent", () => {
  it("accepts all 10 known intents", () => {
    for (const v of [
      "hook",
      "context",
      "definition",
      "comparison",
      "mechanism",
      "evidence",
      "example",
      "warning",
      "action",
      "cta",
    ]) {
      expect(() => CopyIntent.parse(v)).not.toThrow();
    }
  });

  it("rejects unknown intent", () => {
    expect(() => CopyIntent.parse("intro")).toThrow();
    expect(() => CopyIntent.parse("")).toThrow();
  });
});
