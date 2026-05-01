import { describe, expect, it } from "vitest";
import { SeriesSchema } from "@core/schemas/series";

const validSeries = {
  id: "claude",
  name: "Claude 카드뉴스",
  theme: "AI/Claude 활용 정보",
  defaultPreset: "c1-dark-lime",
  audience: "AI/개발자",
  tone: "친근하지만 전문적",
  branding: { seriesTag: "CLAUDE SERIES" },
  footerHandle: "@uhuru_nomadlife",
  trustedDomains: ["anthropic.com"],
};

describe("Series", () => {
  it("accepts a valid series", () => {
    expect(() => SeriesSchema.parse(validSeries)).not.toThrow();
  });

  it("rejects empty footerHandle", () => {
    expect(() =>
      SeriesSchema.parse({ ...validSeries, footerHandle: "" })
    ).toThrow();
  });

  it("rejects missing footerHandle", () => {
    const { footerHandle: _omit, ...rest } = validSeries;
    expect(() => SeriesSchema.parse(rest)).toThrow();
  });

  it("defaults trustedDomains to []", () => {
    const { trustedDomains: _omit, ...rest } = validSeries;
    const out = SeriesSchema.parse(rest);
    expect(out.trustedDomains).toEqual([]);
  });

  it("imageProvider defaults to 'codex-image'", () => {
    const out = SeriesSchema.parse(validSeries);
    expect(out.imageProvider).toBe("codex-image");
  });

  it("accepts an explicit imageProvider override", () => {
    const out = SeriesSchema.parse({
      ...validSeries,
      imageProvider: "openai-image",
    });
    expect(out.imageProvider).toBe("openai-image");
  });

  it("rejects empty required strings (e.g. id, name, theme)", () => {
    for (const f of ["id", "name", "theme", "defaultPreset", "audience", "tone"]) {
      expect(() =>
        SeriesSchema.parse({ ...validSeries, [f]: "" })
      ).toThrow();
    }
  });

  it("accepts optional logo + imageStyleOverride", () => {
    const out = SeriesSchema.parse({
      ...validSeries,
      branding: { seriesTag: "X", logo: "data/logo.png" },
      imageStyleOverride: "flat illustration",
    });
    expect(out.branding.logo).toBe("data/logo.png");
    expect(out.imageStyleOverride).toBe("flat illustration");
  });
});
