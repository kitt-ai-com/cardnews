import type { ValidationResult, Violation } from "../validators/types";

export interface WithRetryArgs<T> {
  fn: () => Promise<T>;
  validate: (value: T) => ValidationResult;
  maxAttempts: number;
  onFail?: (violations: Violation[], attempt: number) => void;
}

export interface RetryResult<T> {
  ok: boolean;
  value?: T;
  attempts: number;
  violations: Violation[];
}

export async function withRetry<T>(
  args: WithRetryArgs<T>
): Promise<RetryResult<T>> {
  const { fn, validate, maxAttempts, onFail } = args;
  let lastViolations: Violation[] = [];
  let lastError: unknown = undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let value: T;
    try {
      value = await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) {
        throw err;
      }
      continue;
    }

    const result = validate(value);
    if (result.ok) {
      return { ok: true, value, attempts: attempt, violations: [] };
    }

    lastViolations = result.violations;
    onFail?.(result.violations, attempt);
  }

  // If we got here, every attempt either threw or produced invalid output.
  // Throwing path was handled above. This path is "all attempts failed
  // validation" — return the failed result with the most recent violations.
  if (lastError !== undefined && lastViolations.length === 0) {
    // Defensive: if all attempts threw and somehow we exited the loop, rethrow.
    throw lastError;
  }
  return {
    ok: false,
    attempts: maxAttempts,
    violations: lastViolations,
  };
}
