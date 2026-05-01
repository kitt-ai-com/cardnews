import { describe, expect, it } from "vitest";
import { PresetSchema } from "@core/schemas/preset";

const validPreset = {
  id: "c1-dark-lime",
  name: "다크 모던 + 라임",
  base: "dark-modern",
  canvas: { width: 1080, height: 1350 },
  colors: {
    background: "#0e0e10",
    text: "#ffffff",
    accent: "#c4ff3d",
    muted: "rgba(255,255,255,0.6)",
  },
  typography: {
    fontFamily: ["Pretendard", "Noto Sans KR", "sans-serif"],
    title: { size: 48, weight: 800, lineHeight: 1.2, letterSpacing: -0.02 },
    body: { size: 24, weight: 400, lineHeight: 1.5, letterSpacing: -0.02 },
    label: { size: 14, weight: 600, lineHeight: 1.2, letterSpacing: 0 },
    hierarchyRatio: 1.5,
  },
  spacing: {
    safeZone: { top: 60, right: 48, bottom: 60, left: 48 },
    verticalBands: { header: 0.15, body: 0.7, footer: 0.15 },
    contentRatio: 0.75,
  },
  layouts: ["P1", "P2", "P3"],
  imageStyle: "다크 톤, 추상, 라임 그린 액센트, 텍스트 없음, 미니멀",
};

describe("Preset", () => {
  it("accepts a valid preset", () => {
    expect(() => PresetSchema.parse(validPreset)).not.toThrow();
  });

  it("rejects when title size < body size * hierarchyRatio", () => {
    const bad = structuredClone(validPreset);
    bad.typography.title.size = 30; // 30 < 24 * 1.5 = 36
    expect(() => PresetSchema.parse(bad)).toThrow(/hierarchyRatio/);
  });

  it("rejects empty layouts array", () => {
    const bad = structuredClone(validPreset);
    bad.layouts = [];
    expect(() => PresetSchema.parse(bad)).toThrow();
  });

  it("rejects unknown layout id", () => {
    const bad = structuredClone(validPreset);
    bad.layouts = ["P1", "P9"] as never;
    expect(() => PresetSchema.parse(bad)).toThrow();
  });

  it("rejects verticalBands not summing to 1.0 (within epsilon)", () => {
    const bad = structuredClone(validPreset);
    bad.spacing.verticalBands = { header: 0.2, body: 0.7, footer: 0.05 };
    expect(() => PresetSchema.parse(bad)).toThrow();
  });

  it("accepts verticalBands within tiny float epsilon of 1.0", () => {
    const ok = structuredClone(validPreset);
    ok.spacing.verticalBands = { header: 0.15, body: 0.7, footer: 0.15 };
    expect(() => PresetSchema.parse(ok)).not.toThrow();
  });

  it("rejects hierarchyRatio < 1", () => {
    const bad = structuredClone(validPreset);
    bad.typography.hierarchyRatio = 0.9;
    expect(() => PresetSchema.parse(bad)).toThrow();
  });

  it("rejects empty imageStyle", () => {
    const bad = structuredClone(validPreset);
    bad.imageStyle = "";
    expect(() => PresetSchema.parse(bad)).toThrow();
  });
});
