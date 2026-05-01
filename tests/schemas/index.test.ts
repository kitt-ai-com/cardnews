import { describe, expect, it } from "vitest";
import * as schemas from "@core/schemas";

describe("schemas barrel", () => {
  it("re-exports all 6 schema modules", () => {
    expect(schemas.SourcePolicySchema).toBeDefined();
    expect(schemas.CardStatusSchema).toBeDefined();
    expect(schemas.PresetSchema).toBeDefined();
    expect(schemas.SeriesSchema).toBeDefined();
    expect(schemas.PageSchema).toBeDefined();
    expect(schemas.CardSchema).toBeDefined();
  });

  it("re-exports status helpers", () => {
    expect(typeof schemas.isAwaitingApproval).toBe("function");
    expect(typeof schemas.isInProgress).toBe("function");
    expect(typeof schemas.isTerminal).toBe("function");
  });

  it("re-exports LayoutId enum", () => {
    expect(schemas.LayoutId).toBeDefined();
    expect(() => schemas.LayoutId.parse("P1")).not.toThrow();
  });
});
