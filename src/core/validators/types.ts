import type { Violation } from "../schemas/card";

export type { Violation };

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

export function ok(): ValidationResult {
  return { ok: true, violations: [] };
}

export function fail(violations: Violation[]): ValidationResult {
  return { ok: violations.length === 0, violations: [...violations] };
}

export function merge(...results: ValidationResult[]): ValidationResult {
  const violations: Violation[] = [];
  for (const r of results) {
    if (r.violations.length > 0) violations.push(...r.violations);
  }
  return { ok: violations.length === 0, violations };
}
