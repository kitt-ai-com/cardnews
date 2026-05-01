import { describe, expect, it } from "vitest";
import { ok, fail, merge } from "@core/validators/types";
import type { Violation } from "@core/schemas/card";

describe("validators/types", () => {
  it("ok() returns a passing result", () => {
    expect(ok()).toEqual({ ok: true, violations: [] });
  });

  it("fail([v]) returns a failing result with the violations", () => {
    const v: Violation = { code: "X/Y", message: "boom" };
    expect(fail([v])).toEqual({ ok: false, violations: [v] });
  });

  it("merge() with no args returns ok()", () => {
    expect(merge()).toEqual(ok());
  });

  it("merge(ok(), fail([v])) returns { ok: false, violations: [v] }", () => {
    const v: Violation = { code: "X/Y", message: "boom" };
    expect(merge(ok(), fail([v]))).toEqual({ ok: false, violations: [v] });
  });

  it("merge concatenates violations from multiple failing results", () => {
    const v1: Violation = { code: "A", message: "a" };
    const v2: Violation = { code: "B", message: "b" };
    const result = merge(fail([v1]), ok(), fail([v2]));
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([v1, v2]);
  });
});
