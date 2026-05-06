/**
 * Strip leading/trailing markdown code fences (```json ... ``` or ``` ... ```)
 * and surrounding whitespace from an LLM response.
 */
export function stripMarkdownFences(text: string): string {
  let result = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  result = result.replace(/^```\n?/, "").replace(/\n?```$/, "");
  return result.trim();
}
