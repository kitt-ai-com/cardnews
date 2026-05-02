import { describe, it, expect } from "vitest";
import { presetToTokens, tokensToCSSVars } from "../../src/renderer/tokens";
import { PresetSchema } from "@core/schemas/preset";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDarkLime() {
  const json = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../data/presets/variants/c1-dark-lime.json"),
      "utf8"
    )
  );
  return PresetSchema.parse(json);
}

describe("presetToTokens / tokensToCSSVars", () => {
  it("converts c1-dark-lime preset colors", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    expect(tokens.colors.background).toBe("#0e0e10");
    expect(tokens.colors.text).toBe("#ffffff");
    expect(tokens.colors.accent).toBe("#c4ff3d");
    expect(tokens.colors.muted).toBe("rgba(255,255,255,0.55)");
  });

  it("renders --color-accent in CSS vars output", () => {
    const preset = loadDarkLime();
    const css = tokensToCSSVars(presetToTokens(preset));
    expect(css).toContain("--color-accent: #c4ff3d");
    expect(css.startsWith(":root")).toBe(true);
  });

  it("scopes CSS vars with provided selector", () => {
    const preset = loadDarkLime();
    const css = tokensToCSSVars(presetToTokens(preset), ".scope-1");
    expect(css.startsWith(".scope-1")).toBe(true);
  });

  it("converts letterSpacing -0.02 to '-0.02em'", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    expect(tokens.typography.title.letterSpacing).toBe("-0.02em");
    expect(tokens.typography.body.letterSpacing).toBe("-0.02em");
    expect(tokens.typography.label.letterSpacing).toBe("0.075em");
  });

  it("computes contentMaxWidth = canvas.width * contentRatio", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    // 1080 * 0.75 = 810
    expect(tokens.spacing.contentMaxWidth).toBe("810px");
  });

  it("converts canvas dims and safeZone to px", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    expect(tokens.canvas.width).toBe("1080px");
    expect(tokens.canvas.height).toBe("1350px");
    expect(tokens.spacing.safeTop).toBe("60px");
    expect(tokens.spacing.safeRight).toBe("48px");
    expect(tokens.spacing.safeBottom).toBe("60px");
    expect(tokens.spacing.safeLeft).toBe("48px");
  });

  it("converts vertical bands to %", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    expect(tokens.spacing.bandHeader).toBe("15%");
    expect(tokens.spacing.bandBody).toBe("70%");
    expect(tokens.spacing.bandFooter).toBe("15%");
  });

  it("joins fontFamily array with comma+space", () => {
    const preset = loadDarkLime();
    const tokens = presetToTokens(preset);
    expect(tokens.typography.fontFamily).toBe(
      "Pretendard, Noto Sans KR, sans-serif"
    );
  });
});
