import { describe, expect, it, vi } from "vitest";
import { withRetry } from "@core/orchestrator/retry";
import { fail, ok, type ValidationResult } from "@core/validators/types";

describe("withRetry", () => {
  it("returns first result when validate passes (1 attempt, fn called once)", async () => {
    const fn = vi.fn().mockResolvedValue("value-1");
    const validate = (_v: string): ValidationResult => ok();

    const result = await withRetry({ fn, validate, maxAttempts: 3 });

    expect(result.ok).toBe(true);
    expect(result.value).toBe("value-1");
    expect(result.attempts).toBe(1);
    expect(result.violations).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxAttempts on validation failure", async () => {
    const fn = vi.fn().mockResolvedValue("bad");
    const violation = {
      level: "L3" as const,
      code: "TEST/FAIL",
      message: "always invalid",
    };
    const validate = (_v: string): ValidationResult => fail([violation]);

    const result = await withRetry({ fn, validate, maxAttempts: 3 });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe("TEST/FAIL");
  });

  it("passes violations into onFail with attempt number; succeeds on later attempt", async () => {
    let count = 0;
    const fn = vi.fn().mockImplementation(async () => {
      count += 1;
      return `value-${count}`;
    });
    const violation = {
      level: "L3" as const,
      code: "TEST/MAYBE",
      message: "first two fail",
    };
    const validate = (v: string): ValidationResult => {
      if (v === "value-3") return ok();
      return fail([violation]);
    };
    const onFail = vi.fn();

    const result = await withRetry({ fn, validate, maxAttempts: 5, onFail });

    expect(result.ok).toBe(true);
    expect(result.value).toBe("value-3");
    expect(result.attempts).toBe(3);
    expect(result.violations).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onFail).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenNthCalledWith(1, [violation], 1);
    expect(onFail).toHaveBeenNthCalledWith(2, [violation], 2);
  });

  it("re-throws errors after maxAttempts is exhausted", async () => {
    const err = new Error("boom");
    const fn = vi.fn().mockRejectedValue(err);
    const validate = (_v: unknown): ValidationResult => ok();

    await expect(
      withRetry({ fn, validate, maxAttempts: 3 })
    ).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
