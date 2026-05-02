import { describe, it, expect } from "vitest";
import { parseArgs, findChrome } from "../../scripts/m3-export";

describe("m3-export script helpers", () => {
  describe("parseArgs", () => {
    it("returns useExisting=false when no --card flag", () => {
      expect(parseArgs([])).toEqual({ useExisting: false, cardId: null });
      expect(parseArgs(["--whatever"])).toEqual({
        useExisting: false,
        cardId: null,
      });
    });

    it("parses --card <id>", () => {
      expect(parseArgs(["--card", "card-123"])).toEqual({
        useExisting: true,
        cardId: "card-123",
      });
    });

    it("throws when --card has no following id", () => {
      expect(() => parseArgs(["--card"])).toThrow(/--card requires/);
    });
  });

  describe("findChrome", () => {
    it("returns either a string path or null (never undefined)", () => {
      const result = findChrome();
      // Either an existing absolute path or null. Don't assert specifics —
      // the tested machine may or may not have Chrome installed.
      expect(result === null || typeof result === "string").toBe(true);
      if (typeof result === "string") {
        expect(result.startsWith("/")).toBe(true);
      }
    });
  });
});
