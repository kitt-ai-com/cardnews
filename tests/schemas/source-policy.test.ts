import { describe, expect, it } from "vitest";
import { SourcePolicySchema } from "@core/schemas/source-policy";

describe("SourcePolicy", () => {
  it("accepts a valid policy", () => {
    const ok = SourcePolicySchema.parse({
      trustLevel: "primary",
      factCheckMode: "skip",
    });
    expect(ok.trustLevel).toBe("primary");
    expect(ok.factCheckMode).toBe("skip");
  });

  it("accepts every defined trustLevel", () => {
    for (const tl of ["primary", "secondary", "user-provided", "unknown"]) {
      expect(() =>
        SourcePolicySchema.parse({ trustLevel: tl, factCheckMode: "warn" })
      ).not.toThrow();
    }
  });

  it("accepts every defined factCheckMode", () => {
    for (const m of ["skip", "warn", "strict"]) {
      expect(() =>
        SourcePolicySchema.parse({ trustLevel: "unknown", factCheckMode: m })
      ).not.toThrow();
    }
  });

  it("rejects unknown trustLevel", () => {
    expect(() =>
      SourcePolicySchema.parse({ trustLevel: "wat", factCheckMode: "skip" })
    ).toThrow();
  });

  it("rejects unknown factCheckMode", () => {
    expect(() =>
      SourcePolicySchema.parse({ trustLevel: "unknown", factCheckMode: "vibes" })
    ).toThrow();
  });
});
