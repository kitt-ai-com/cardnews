import { describe, expect, it } from "vitest";
import { InfoPatternId } from "@core/schemas/info-pattern";

describe("InfoPatternId", () => {
  it("accepts I1..I6", () => {
    for (const v of ["I1", "I2", "I3", "I4", "I5", "I6"]) {
      expect(() => InfoPatternId.parse(v)).not.toThrow();
    }
  });

  it("rejects I7 or random values", () => {
    expect(() => InfoPatternId.parse("I7")).toThrow();
    expect(() => InfoPatternId.parse("i1")).toThrow();
    expect(() => InfoPatternId.parse("P1")).toThrow();
  });
});
